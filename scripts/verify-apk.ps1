$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$apkPath = Join-Path $taskRoot 'artifacts/Boutique-Dah.apk'
$taskJava = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { Join-Path $taskRoot '.android-tools/jdk' }
$env:JAVA_HOME = $taskJava
$env:Path = (Join-Path $taskJava 'bin') + ';' + $env:Path
$taskSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $taskRoot '.android-tools/sdk' }
$buildTools = Join-Path $taskSdk 'build-tools/36.0.0'
if (!(Test-Path -LiteralPath $apkPath)) { throw 'The signed APK has not been produced.' }
& (Join-Path $buildTools 'apksigner.bat') verify --verbose --print-certs $apkPath
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
$badging = & (Join-Path $buildTools 'aapt.exe') dump badging $apkPath
if ($LASTEXITCODE -ne 0) { throw 'Could not read APK metadata.' }
if (!($badging -match "package: name='com.boutiquedah.app'")) { throw 'Unexpected Android package identity.' }
if ($badging -match 'application-debuggable') { throw 'APK must be a release build.' }
$badging | Select-String -Pattern '^package:','^sdkVersion:','^targetSdkVersion:','^application-label:','^launchable-activity:'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
try {
    $required = @('index.html','lists/index.html','lists/new/index.html','commissions/index.html','settings/index.html')
    foreach ($page in $required) {
        if (!$archive.GetEntry("assets/public/$page")) { throw "Missing bundled screen: $page" }
    }
    if ($archive.Entries.FullName -match '(\.jks$|\.keystore$|signing\.properties|(^|/)\.env|(^|/)\.data/)') { throw 'Private build or database files were packaged.' }
    foreach ($obsolete in @('sw.js','offline.html','manifest.webmanifest','login/index.html')) {
        if ($archive.GetEntry("assets/public/$obsolete")) { throw "Obsolete browser/server feature was packaged: $obsolete" }
    }
    $configEntry = $archive.GetEntry('assets/capacitor.config.json')
    $reader = New-Object System.IO.StreamReader($configEntry.Open())
    try { $config = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    if ($config.server.url) { throw 'The APK must not load a hosted website.' }
} finally { $archive.Dispose() }
$sha = [System.Security.Cryptography.SHA256]::Create()
$apkStream = [System.IO.File]::OpenRead($apkPath)
try { $hash = [BitConverter]::ToString($sha.ComputeHash($apkStream)).Replace('-', '').ToLowerInvariant() }
finally { $apkStream.Dispose(); $sha.Dispose() }
"$hash  Boutique-Dah.apk" | Set-Content -LiteralPath (Join-Path $taskRoot 'artifacts/Boutique-Dah.apk.sha256')
Get-Item -LiteralPath $apkPath | Select-Object Name,Length
Write-Output 'Verified signed release APK, five bundled screens, and no hosted server URL.'
