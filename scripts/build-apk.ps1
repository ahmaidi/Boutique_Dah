$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$toolDir = Join-Path $taskRoot '.android-tools'
$javaCandidates = @($env:JAVA_HOME, (Join-Path $toolDir 'jdk'), 'C:/Program Files/Android/Android Studio/jbr')
$javaCommand = Get-Command java -ErrorAction SilentlyContinue
if ($javaCommand) { $javaCandidates += Split-Path -Parent (Split-Path -Parent $javaCommand.Source) }
$taskJava = $javaCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin/java.exe')) } | Select-Object -First 1
$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $toolDir 'sdk'), (Join-Path $env:LOCALAPPDATA 'Android/Sdk'))
$taskSdk = $sdkCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platforms/android-36/android.jar')) } | Select-Object -First 1
if (!$taskJava -or !$taskSdk) {
    throw 'Install Java 21 and Android SDK Platform 36 / Build Tools 36.0.0 first. See docs/android-install.md. No APK has been built yet.'
}
$env:JAVA_HOME = $taskJava
$env:ANDROID_HOME = $taskSdk
$env:GRADLE_USER_HOME = Join-Path $toolDir 'gradle-home'
$env:Path = (Join-Path $taskJava 'bin') + ';' + $env:Path

# Keep this signing identity for every future update; never commit or share it.
$signDir = Join-Path $taskRoot '.android-signing'
$keyFile = Join-Path $signDir 'boutique-dah.jks'
$propertiesFile = Join-Path $signDir 'signing.properties'
New-Item -ItemType Directory -Path $signDir -Force | Out-Null
if ((Test-Path -LiteralPath $keyFile) -and !(Test-Path -LiteralPath $propertiesFile)) {
    throw 'Signing properties are missing. Restore them with the existing key before building an update.'
}
if (!(Test-Path -LiteralPath $keyFile)) {
    if (Test-Path -LiteralPath $propertiesFile) { throw 'Signing key is missing. Restore it before building an update.' }
    $randomBytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
    $env:BOUTIQUE_SIGNING_PASSWORD = [Convert]::ToBase64String($randomBytes)
    try {
        & (Join-Path $taskJava 'bin/keytool.exe') -genkeypair -keystore $keyFile -storetype JKS -alias boutique-dah -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Boutique Dah' -storepass:env BOUTIQUE_SIGNING_PASSWORD -keypass:env BOUTIQUE_SIGNING_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Could not generate the APK signing key.' }
        $keyPath = $keyFile.Replace('\', '/')
        $properties = "storeFile=$keyPath`nstorePassword=$env:BOUTIQUE_SIGNING_PASSWORD`nkeyAlias=boutique-dah`nkeyPassword=$env:BOUTIQUE_SIGNING_PASSWORD`n"
        [System.IO.File]::WriteAllText($propertiesFile, $properties, (New-Object System.Text.UTF8Encoding $false))
    } finally {
        Remove-Item Env:BOUTIQUE_SIGNING_PASSWORD -ErrorAction SilentlyContinue
    }
}
Push-Location (Join-Path $taskRoot 'android')
try {
    & ./gradlew.bat :app:testReleaseUnitTest assembleRelease --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android compilation failed; no new APK was copied.' }
    $apk = Join-Path $taskRoot 'android/app/build/outputs/apk/release/app-release.apk'
    $artifacts = Join-Path $taskRoot 'artifacts'
    New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
    Copy-Item -LiteralPath $apk -Destination (Join-Path $artifacts 'Boutique-Dah.apk') -Force
    & (Join-Path $PSScriptRoot 'verify-apk.ps1')
    Write-Output 'Signed APK ready: artifacts/Boutique-Dah.apk'
} finally { Pop-Location }
