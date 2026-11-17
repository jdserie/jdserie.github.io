//go:build windows

// Who Would Win 2.0's per-user setup installs shortcuts to the existing Edge profile.
package main

import (
	"debug/pe"
	_ "embed"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

//go:embed Fight2.ico
var icon []byte

const installURL = "https://jdserie.github.io/projects/who-would-win-2/web/#downloads"
const appArgs = "--app=https://jdserie.github.io/projects/who-would-win-2/web/"

var (
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	ole32    = syscall.NewLazyDLL("ole32.dll")
	regValue = syscall.NewLazyDLL("advapi32.dll").NewProc("RegGetValueW")
	message  = syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
)

type guid struct {
	first         uint32
	second, third uint16
	last          [8]byte
}

var (
	clsidLink = guid{0x00021401, 0, 0, [8]byte{0xc0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidLink   = guid{0x000214f9, 0, 0, [8]byte{0xc0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidFile   = guid{0x0000010b, 0, 0, [8]byte{0xc0, 0, 0, 0, 0, 0, 0, 0x46}}
)

type shellLink struct {
	vtable *struct {
		query, addRef, release                                                 uintptr
		getPath, getIDList, setIDList, getDescription, setDescription          uintptr
		getWorkingDirectory, setWorkingDirectory, getArguments, setArguments   uintptr
		getHotkey, setHotkey, getShowCommand, setShowCommand, getIcon, setIcon uintptr
		setRelativePath, resolve, setPath                                      uintptr
	}
}

type persistFile struct {
	vtable *struct {
		query, addRef, release, getClass, isDirty, load, save uintptr
	}
}

func wide(value string) *uint16 {
	text, err := syscall.UTF16PtrFromString(value)
	if err != nil {
		panic(err)
	}
	return text
}

func failed(result uintptr) bool {
	return int32(result) < 0
}

func nativeMachine() uint16 {
	detect := kernel32.NewProc("IsWow64Process2")
	if detect.Find() == nil {
		var process, native uint16
		// (HANDLE)-1 is the current process.
		ok, _, _ := detect.Call(^uintptr(0), uintptr(unsafe.Pointer(&process)), uintptr(unsafe.Pointer(&native)))
		if ok != 0 {
			return native
		}
	}
	// Early versions of Windows 10 did not expose IsWow64Process2.
	switch os.Getenv("PROCESSOR_ARCHITEW6432") {
	case "AMD64":
		return pe.IMAGE_FILE_MACHINE_AMD64
	case "ARM64":
		return pe.IMAGE_FILE_MACHINE_ARM64
	}
	switch runtime.GOARCH {
	case "amd64":
		return pe.IMAGE_FILE_MACHINE_AMD64
	case "arm64":
		return pe.IMAGE_FILE_MACHINE_ARM64
	default:
		return pe.IMAGE_FILE_MACHINE_I386
	}
}

func machineName(machine uint16) string {
	switch machine {
	case pe.IMAGE_FILE_MACHINE_I386:
		return "32-bit (x86)"
	case pe.IMAGE_FILE_MACHINE_AMD64:
		return "64-bit (x64)"
	case pe.IMAGE_FILE_MACHINE_ARM64:
		return "ARM64"
	default:
		return "unknown architecture"
	}
}

func compatibleEdge(path string, native uint16) bool {
	binary, err := pe.Open(path)
	if err != nil {
		return false
	}
	defer binary.Close()
	if binary.Characteristics&0x0002 == 0 || binary.Characteristics&0x2000 != 0 {
		return false
	}
	switch binary.Machine {
	case pe.IMAGE_FILE_MACHINE_I386:
		return native == pe.IMAGE_FILE_MACHINE_I386 ||
			native == pe.IMAGE_FILE_MACHINE_AMD64 || native == pe.IMAGE_FILE_MACHINE_ARM64
	case pe.IMAGE_FILE_MACHINE_AMD64:
		// Windows 11 on ARM supports x64 emulation. CreateProcess checks
		// whether the installed version of Windows can actually launch it.
		return native == pe.IMAGE_FILE_MACHINE_AMD64 || native == pe.IMAGE_FILE_MACHINE_ARM64
	case pe.IMAGE_FILE_MACHINE_ARM64, 0xa641, 0xa64e: // ARM64, ARM64EC, ARM64X
		return native == pe.IMAGE_FILE_MACHINE_ARM64
	default:
		return false
	}
}

func edgeCandidates() []string {
	var paths []string
	key := wide(`Software\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe`)
	for _, root := range []syscall.Handle{syscall.HKEY_CURRENT_USER, syscall.HKEY_LOCAL_MACHINE} {
		for _, view := range []uintptr{0, 0x10000, 0x20000} {
			var path [1024]uint16
			size := uint32(unsafe.Sizeof(path))
			result, _, _ := regValue.Call(uintptr(root), uintptr(unsafe.Pointer(key)), 0, 0x6|view, 0,
				uintptr(unsafe.Pointer(&path[0])), uintptr(unsafe.Pointer(&size)))
			if result == 0 {
				paths = append(paths, syscall.UTF16ToString(path[:]))
			}
		}
	}
	for _, variable := range []string{"ProgramFiles(x86)", "ProgramW6432", "ProgramFiles", "LOCALAPPDATA"} {
		if folder := os.Getenv(variable); folder != "" {
			paths = append(paths, filepath.Join(folder, "Microsoft", "Edge", "Application", "msedge.exe"))
		}
	}
	return paths
}

func launchEdge(native uint16) (string, error) {
	var launchError error
	seen := make(map[string]bool)
	for _, path := range edgeCandidates() {
		if !filepath.IsAbs(path) || seen[path] || !compatibleEdge(path, native) {
			continue
		}
		seen[path] = true
		cmd := exec.Command(path, appArgs)
		if err := cmd.Start(); err != nil {
			launchError = err
			continue
		}
		_ = cmd.Process.Release()
		return path, nil
	}
	if launchError != nil {
		return "", fmt.Errorf("Windows could not start Microsoft Edge (%v). Open Who Would Win 2.0 in your browser and use its install menu.", launchError)
	}
	return "", fmt.Errorf("A compatible copy of Microsoft Edge was not found for %s Windows. Open Who Would Win 2.0 in Edge or Chrome and use its install menu.", machineName(native))
}

func folder(id uintptr) (string, error) {
	var path [260]uint16
	result, _, _ := shell32.NewProc("SHGetFolderPathW").Call(0, id, 0, 0, uintptr(unsafe.Pointer(&path[0])))
	if failed(result) {
		return "", fmt.Errorf("Windows folder lookup failed (0x%08x)", uint32(result))
	}
	return syscall.UTF16ToString(path[:]), nil
}

func installShortcuts(browser, iconPath string) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	result, _, _ := ole32.NewProc("CoInitializeEx").Call(0, 2)
	if failed(result) {
		return fmt.Errorf("Windows could not start its shortcut service (0x%08x)", uint32(result))
	}
	defer ole32.NewProc("CoUninitialize").Call()

	var link *shellLink
	result, _, _ = ole32.NewProc("CoCreateInstance").Call(uintptr(unsafe.Pointer(&clsidLink)), 0, 1,
		uintptr(unsafe.Pointer(&iidLink)), uintptr(unsafe.Pointer(&link)))
	if failed(result) {
		return fmt.Errorf("Windows could not create a shortcut (0x%08x)", uint32(result))
	}
	defer func() { syscall.SyscallN(link.vtable.release, uintptr(unsafe.Pointer(link))) }()
	setPath := link.vtable.setPath
	setArguments := link.vtable.setArguments
	setIcon := link.vtable.setIcon
	result, _, _ = syscall.SyscallN(setPath, uintptr(unsafe.Pointer(link)), uintptr(unsafe.Pointer(wide(browser))))
	if !failed(result) {
		result, _, _ = syscall.SyscallN(setArguments, uintptr(unsafe.Pointer(link)), uintptr(unsafe.Pointer(wide(appArgs))))
	}
	if !failed(result) {
		result, _, _ = syscall.SyscallN(setIcon, uintptr(unsafe.Pointer(link)), uintptr(unsafe.Pointer(wide(iconPath))), 0)
	}
	if failed(result) {
		return fmt.Errorf("Windows could not set up the shortcut (0x%08x)", uint32(result))
	}

	var file *persistFile
	result, _, _ = syscall.SyscallN(link.vtable.query, uintptr(unsafe.Pointer(link)),
		uintptr(unsafe.Pointer(&iidFile)), uintptr(unsafe.Pointer(&file)))
	if failed(result) {
		return fmt.Errorf("Windows could not open its shortcut writer (0x%08x)", uint32(result))
	}
	defer func() { syscall.SyscallN(file.vtable.release, uintptr(unsafe.Pointer(file))) }()
	saved := false
	for _, id := range []uintptr{0x10, 2} { // Desktop, Start menu Programs
		directory, err := folder(id)
		if err != nil {
			continue
		}
		path := wide(filepath.Join(directory, "Who Would Win 2.0.lnk"))
		result, _, _ = syscall.SyscallN(file.vtable.save, uintptr(unsafe.Pointer(file)), uintptr(unsafe.Pointer(path)), 1)
		saved = saved || !failed(result)
	}
	if !saved {
		return errors.New("Windows could not save a shortcut to the desktop or Start menu.")
	}
	return nil
}

func setup() error {
	browser, err := launchEdge(nativeMachine())
	if err != nil {
		return err
	}
	localAppData, err := folder(0x1c)
	if err != nil {
		return err
	}
	directory := filepath.Join(localAppData, "Who Would Win 2.0")
	if err := os.MkdirAll(directory, 0700); err != nil {
		return err
	}
	iconPath := filepath.Join(directory, "Fight2.ico")
	if err := os.WriteFile(iconPath, icon, 0600); err != nil {
		return err
	}
	return installShortcuts(browser, iconPath)
}

func main() {
	if err := setup(); err != nil {
		detail := fmt.Sprintf("%s\n\nOpen the Who Would Win 2.0 Install page for browser installation?", err)
		answer, _, _ := message.Call(0, uintptr(unsafe.Pointer(wide(detail))), uintptr(unsafe.Pointer(wide("Who Would Win 2.0 Setup"))), 0x34)
		if answer == 6 {
			shell32.NewProc("ShellExecuteW").Call(0, uintptr(unsafe.Pointer(wide("open"))),
				uintptr(unsafe.Pointer(wide(installURL))), 0, 0, 1)
		}
		os.Exit(1)
	}
}
