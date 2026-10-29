# Reuse the workspace's locked Wry/Tao tool dependencies; never edit that repo.
param([Parameter(Mandatory=$true)][string]$SourceNativeDirectory)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$stage=Join-Path $projectRoot '.cache/demo-review/native'
$target=Join-Path $projectRoot '.cache/demo-review/native-target'
$source=(Resolve-Path -LiteralPath $SourceNativeDirectory).Path
foreach($name in @('Cargo.toml','Cargo.lock')){
  if(-not(Test-Path -LiteralPath (Join-Path $source $name) -PathType Leaf)){throw "Missing native tool metadata: $name"}
}
New-Item -ItemType Directory -Path (Join-Path $stage 'src') -Force | Out-Null
foreach($name in @('Cargo.toml','Cargo.lock')){
  Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $stage $name)
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'native/main.rs') -Destination (Join-Path $stage 'src/main.rs')
& cargo build --offline --locked --manifest-path (Join-Path $stage 'Cargo.toml') --target-dir $target
if($LASTEXITCODE -ne 0){throw "Native preview build failed: $LASTEXITCODE"}
Write-Output (Join-Path $target 'debug/settings-visual.exe')
