# Adapted from the workspace native settings visual capture; no browser instance.
param(
  [Parameter(Mandatory=$true)][string]$NativeHostPath,
  [ValidateRange(320,2560)][int]$Width=1440,
  [ValidateRange(240,1440)][int]$Height=900,
  [ValidatePattern('^[a-z-]+$')][string]$Scenario='library',
  [ValidatePattern('^[a-zA-Z0-9-]+$')][string]$Run='1',
  [ValidateSet(41387,41388)][int]$Port=41387,
  [ValidatePattern('^[a-zA-Z0-9/.-]*$')][string]$Page='demo/',
  [ValidateRange(0,2)][double]$Scale=0,
  [switch]$ReducedMotion,
  [switch]$LocalFile
)
$ErrorActionPreference="Stop"
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$outputRoot=Join-Path $projectRoot ".cache/demo-review"
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$report=Join-Path $outputRoot "$Scenario-$Run.json"
$picture=Join-Path $outputRoot "$Scenario-$Run.png"
$exe=if($NativeHostPath){[IO.Path]::GetFullPath($NativeHostPath)}else{Join-Path $outputRoot "native-target/debug/settings-visual.exe"}
if(-not(Test-Path -LiteralPath $exe)){throw "Native host not found. Build scripts/settings-visual/native or pass -NativeHostPath."}
$data=Join-Path $outputRoot "webview-data-$Run"
Add-Type -AssemblyName System.Drawing
if(-not ("DemoVisualCapture" -as [type])) {
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DemoVisualCapture {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  private delegate bool EnumWindowsCallback(IntPtr window, IntPtr state);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr state);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern uint GetDpiForSystem();
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out Rect r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool RedrawWindow(IntPtr h, IntPtr rect, IntPtr region, uint flags);
  public static string WindowTitle(IntPtr window) {
    var title = new StringBuilder(256);
    GetWindowText(window, title, title.Capacity);
    return title.ToString();
  }
  public static bool IsOwnedWindow(IntPtr window, int processId) {
    uint owner;
    return window != IntPtr.Zero && GetWindowThreadProcessId(window, out owner) != 0 && owner == (uint)processId;
  }
  public static IntPtr FindPreviewWindow(int processId, string expectedTitle) {
    IntPtr titled = IntPtr.Zero, largest = IntPtr.Zero;
    long titledArea = 0, largestArea = 0;
    EnumWindows((window, state) => {
      Rect rect;
      if (!IsOwnedWindow(window, processId) || !IsWindowVisible(window) || !GetClientRect(window, out rect)) return true;
      int width = rect.Right - rect.Left, height = rect.Bottom - rect.Top;
      // Native tooltips can become Process.MainWindowHandle. They must never
      // qualify as the Wry preview, even when the DOM report is already ready.
      if (width < 320 || height < 240) return true;
      long area = (long)width * height;
      if (area > largestArea) { largest = window; largestArea = area; }
      if (WindowTitle(window) == expectedTitle && area > titledArea) { titled = window; titledArea = area; }
      return true;
    }, IntPtr.Zero);
    return titled != IntPtr.Zero ? titled : largest;
  }
  public static bool CloseOwnedWindow(IntPtr window, int processId) {
    return IsOwnedWindow(window, processId) && PostMessage(window, 0x0010, IntPtr.Zero, IntPtr.Zero);
  }
}
'@
}

function Assert-CaptureViewport($Result, [int]$ClientWidth, [int]$ClientHeight, [int]$RequestedWidth, [int]$RequestedHeight) {
  $viewportWidth=[double]$Result.width
  $viewportHeight=[double]$Result.height
  $pixelRatio=[double]$Result.dpr
  if([double]::IsNaN($pixelRatio) -or [double]::IsInfinity($pixelRatio) -or $pixelRatio -lt 0.5 -or $pixelRatio -gt 8){
    throw "Preview reported an invalid device pixel ratio: $pixelRatio"
  }
  if([double]::IsNaN($viewportWidth) -or [double]::IsInfinity($viewportWidth) -or [double]::IsNaN($viewportHeight) -or [double]::IsInfinity($viewportHeight) -or
    [Math]::Abs($viewportWidth-$RequestedWidth) -gt 2 -or [Math]::Abs($viewportHeight-$RequestedHeight) -gt 2){
    throw "Preview viewport ${viewportWidth}x${viewportHeight} does not match requested ${RequestedWidth}x${RequestedHeight}."
  }
  $expectedWidth=[Math]::Round($viewportWidth*$pixelRatio)
  $expectedHeight=[Math]::Round($viewportHeight*$pixelRatio)
  $tolerance=[Math]::Max(4,2*$pixelRatio)
  if($ClientWidth -lt 320 -or $ClientHeight -lt 240 -or
    [Math]::Abs($ClientWidth-$expectedWidth) -gt $tolerance -or [Math]::Abs($ClientHeight-$expectedHeight) -gt $tolerance){
    throw "Native preview client ${ClientWidth}x${ClientHeight} does not match viewport ${viewportWidth}x${viewportHeight} at DPR $pixelRatio (expected ${expectedWidth}x${expectedHeight}); refusing to save a misleading screenshot."
  }
}

function Test-CaptureHasContent([Drawing.Bitmap]$Bitmap) {
  # A successful PrintWindow call can still return an unpainted composition.
  # The preview always contains controls/panels, even in empty/error states.
  $min=765
  $max=0
  $stepX=[Math]::Max(1,[int][Math]::Floor($Bitmap.Width/64))
  $stepY=[Math]::Max(1,[int][Math]::Floor($Bitmap.Height/48))
  for($y=0;$y -lt $Bitmap.Height;$y+=$stepY){
    for($x=0;$x -lt $Bitmap.Width;$x+=$stepX){
      $pixel=$Bitmap.GetPixel($x,$y)
      $level=[int]$pixel.R+[int]$pixel.G+[int]$pixel.B
      $min=[Math]::Min($min,$level)
      $max=[Math]::Max($max,$level)
      if($max-$min -gt 36){return $true}
    }
  }
  # Minimal startup screens may contain only a small centered message that
  # falls between coarse samples. Inspect a bounded center region more closely.
  $centerX=[int][Math]::Floor($Bitmap.Width/2)
  $centerY=[int][Math]::Floor($Bitmap.Height/2)
  $left=[Math]::Max(0,$centerX-256)
  $right=[Math]::Min($Bitmap.Width-1,$centerX+255)
  $top=[Math]::Max(0,$centerY-96)
  $bottom=[Math]::Min($Bitmap.Height-1,$centerY+95)
  for($y=$top;$y -le $bottom;$y+=2){
    for($x=$left;$x -le $right;$x+=2){
      $pixel=$Bitmap.GetPixel($x,$y)
      $level=[int]$pixel.R+[int]$pixel.G+[int]$pixel.B
      $min=[Math]::Min($min,$level)
      $max=[Math]::Max($max,$level)
      if($max-$min -gt 36){return $true}
    }
  }
  return $false
}

# A failed run must not leave an older PNG looking like its new result.
if(Test-Path -LiteralPath $picture){Remove-Item -LiteralPath $picture -Force}
$started=Get-Date
$previewUrl="http://127.0.0.1:$Port/${Page}?qa=$Scenario"
if($LocalFile){
  $docsRoot=[IO.Path]::GetFullPath((Join-Path $projectRoot 'docs'))
  $localPage=[IO.Path]::GetFullPath((Join-Path $docsRoot $Page))
  if($localPage -ne $docsRoot -and -not $localPage.StartsWith($docsRoot + [IO.Path]::DirectorySeparatorChar)){throw 'File preview must stay inside docs.'}
  if(Test-Path -LiteralPath $localPage -PathType Container){$localPage=Join-Path $localPage 'index.html'}
  if(-not(Test-Path -LiteralPath $localPage -PathType Leaf)){throw 'File preview page not found.'}
  $previewUrl=([Uri]::new($localPage)).AbsoluteUri + "?qa=$Scenario"
}
$launchWidth=$Width
$launchHeight=$Height
$oldArguments=$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$oldFileRoot=$env:CLIPKNIFE_DEMO_FILE_ROOT
$oldQaScript=$env:CLIPKNIFE_DEMO_QA_SCRIPT
$arguments=$oldArguments
if($ReducedMotion){$arguments += ' --force-prefers-reduced-motion'}
if($Scale -gt 0){
  $prior=[DemoVisualCapture]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
  try {$systemScale=[DemoVisualCapture]::GetDpiForSystem()/96.0}
  finally {[DemoVisualCapture]::SetThreadDpiAwarenessContext($prior) | Out-Null}
  $launchWidth=[Math]::Round($Width*$Scale/$systemScale)
  $launchHeight=[Math]::Round($Height*$Scale/$systemScale)
  $arguments += " --force-device-scale-factor=$Scale"
}
try {
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$arguments
  if($LocalFile){
    $env:CLIPKNIFE_DEMO_FILE_ROOT=([Uri]::new($docsRoot + [IO.Path]::DirectorySeparatorChar)).AbsoluteUri
    $env:CLIPKNIFE_DEMO_QA_SCRIPT=Join-Path $PSScriptRoot 'qa.js'
  }
  $process=Start-Process -FilePath $exe -ArgumentList @($previewUrl,$launchWidth,$launchHeight,('"' + $report + '"'),('"' + $data + '"')) -WindowStyle Hidden -PassThru
} finally {
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$oldArguments
  $env:CLIPKNIFE_DEMO_FILE_ROOT=$oldFileRoot
  $env:CLIPKNIFE_DEMO_QA_SCRIPT=$oldQaScript
}
$handle=[IntPtr]::Zero
$previousDpiContext=[IntPtr]::Zero
$previewTitle="素刀 UI 对照 — 隔离预览"
try {
  # Compare physical client bounds with the DOM's CSS viewport * devicePixelRatio.
  $previousDpiContext=[DemoVisualCapture]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
  if($previousDpiContext -eq [IntPtr]::Zero){throw "Unable to enter per-monitor DPI awareness for native capture."}
  for($attempt=0;$attempt -lt 80;$attempt++){
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if($process.HasExited){ throw "Preview host exited with code $($process.ExitCode)" }
    if((Test-Path -LiteralPath $report) -and (Get-Item -LiteralPath $report).LastWriteTime -gt $started){break}
  }
  if((-not (Test-Path -LiteralPath $report)) -or (Get-Item -LiteralPath $report).LastWriteTime -le $started){throw "Preview did not report ready before the timeout"}
  $result=Get-Content -LiteralPath $report -Raw -Encoding UTF8 | ConvertFrom-Json
  if($result.scenario -ne $Scenario){throw "Unexpected demo report on port $Port; requested $Scenario."}
  $handle=[DemoVisualCapture]::FindPreviewWindow($process.Id,$previewTitle)
  if($handle -eq [IntPtr]::Zero){throw "Preview window was not found"}
  [DemoVisualCapture]::SetForegroundWindow($handle) | Out-Null
  Start-Sleep -Milliseconds 400
  $rect=New-Object DemoVisualCapture+Rect
  if(-not [DemoVisualCapture]::IsOwnedWindow($handle,$process.Id) -or -not [DemoVisualCapture]::GetClientRect($handle,[ref]$rect)){
    throw "The selected preview window is no longer owned by this capture process."
  }
  $clientWidth=$rect.Right-$rect.Left
  $clientHeight=$rect.Bottom-$rect.Top
  Assert-CaptureViewport $result $clientWidth $clientHeight $Width $Height
  $captured=$false
  for($paintAttempt=0;$paintAttempt -lt 3 -and -not $captured;$paintAttempt++){
    if($paintAttempt -gt 0){
      if(-not [DemoVisualCapture]::IsOwnedWindow($handle,$process.Id)){throw "Preview window ownership changed during capture."}
      [DemoVisualCapture]::SetForegroundWindow($handle) | Out-Null
      [DemoVisualCapture]::RedrawWindow($handle,[IntPtr]::Zero,[IntPtr]::Zero,389) | Out-Null
      Start-Sleep -Milliseconds 350
    }
    $bitmap=New-Object Drawing.Bitmap($clientWidth,$clientHeight)
    try {
      $graphics=[Drawing.Graphics]::FromImage($bitmap)
      try {
        $dc=$graphics.GetHdc()
        try {if(-not [DemoVisualCapture]::PrintWindow($handle,$dc,3)){throw "Native PrintWindow failed"}}
        finally {$graphics.ReleaseHdc($dc)}
      } finally {$graphics.Dispose()}
      if(Test-CaptureHasContent $bitmap){
        $bitmap.Save($picture,[Drawing.Imaging.ImageFormat]::Png)
        $captured=$true
      }
    } finally {$bitmap.Dispose()}
  }
  if(-not $captured){throw "Native capture remained blank after 3 bounded paint attempts; no screenshot was saved. The DOM report alone is not visual acceptance."}
  Write-Output "$Scenario : $($result.interactions.Count) checks, $($result.errors.Count) errors"
  Write-Output "Screenshot: $picture (${clientWidth}x${clientHeight}, DPR $($result.dpr))"
  if($result.errors.Count -gt 0){throw "Preview reported a runtime error; see $report"}
  if($result.imageFailures.Count -gt 0){throw "Preview has failed image resources; see $report"}
  if(@($result.interactions | Where-Object { -not $_.passed }).Count -gt 0){throw "An interaction check failed; see $report"}
} finally {
  try {
    $process.Refresh()
    if(-not $process.HasExited){
      if(-not [DemoVisualCapture]::IsOwnedWindow($handle,$process.Id)){
        $handle=[DemoVisualCapture]::FindPreviewWindow($process.Id,$previewTitle)
      }
      [DemoVisualCapture]::CloseOwnedWindow($handle,$process.Id) | Out-Null
      if(-not $process.WaitForExit(3000)){
        # Kill only the Process instance returned by this Start-Process call.
        $process.Kill()
        if(-not $process.WaitForExit(3000)){Write-Warning "Preview host $($process.Id) did not exit after termination."}
      }
    }
  } catch {Write-Warning "Could not clean up preview host $($process.Id): $($_.Exception.Message)"}
  finally {
    $process.Dispose()
    if($previousDpiContext -ne [IntPtr]::Zero){[DemoVisualCapture]::SetThreadDpiAwarenessContext($previousDpiContext) | Out-Null}
  }
}
