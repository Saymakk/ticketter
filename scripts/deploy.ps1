#Requires -Version 5.1
<#
  Деплой по SSH: копирует remote-deploy.sh на сервер и запускает git pull + docker compose build/up.
  Требуется OpenSSH (ssh, scp) в PATH — обычно уже есть в Windows 10/11.

  Пример:
    .\scripts\deploy.ps1
    .\scripts\deploy.ps1 -Server "78.111.90.103" -SshKey "E:\ssh\myworkspace"
    $env:TICKETTER_SSH_KEY = "E:\ssh\myworkspace"; .\scripts\deploy.ps1
#>
param(
  [string]$Server = "78.111.90.103",
  [string]$User = "root",
  [string]$SshKey = "",
  [string]$RemotePath = "/opt/apps/ticketter"
)

$ErrorActionPreference = "Stop"

if (-not $SshKey) {
  $SshKey = $env:TICKETTER_SSH_KEY
}
if (-not $SshKey) {
  $SshKey = "E:\ssh\myworkspace"
}

if (-not (Test-Path -LiteralPath $SshKey)) {
  throw "SSH-ключ не найден: $SshKey (задайте -SshKey или переменную TICKETTER_SSH_KEY)"
}
$SshKeyResolved = (Resolve-Path -LiteralPath $SshKey).Path

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RemoteScript = Join-Path $ScriptDir "remote-deploy.sh"
if (-not (Test-Path -LiteralPath $RemoteScript)) {
  throw "Не найден файл: $RemoteScript"
}

$SshCommon = @("-i", $SshKeyResolved, "-o", "StrictHostKeyChecking=accept-new")
$Target = "${User}@${Server}"

Write-Host "==> scp $RemoteScript -> ${Server}:/tmp/ticketter-deploy.sh"
& scp @SshCommon $RemoteScript "${Target}:/tmp/ticketter-deploy.sh"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$RemoteCmd = "chmod +x /tmp/ticketter-deploy.sh && bash /tmp/ticketter-deploy.sh '$RemotePath'"
Write-Host "==> ssh $Target $RemoteCmd"
& ssh @SshCommon $Target $RemoteCmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Успешно."
