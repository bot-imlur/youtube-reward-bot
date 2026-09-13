# Upload a local file to Cloudflare R2 via the S3-compatible API.
#
# Usage:
#   .\scripts\uploadToR2.ps1 -LocalFile "C:\Games\reward.rar" -S3Path "gta-sa/reward.rar"
#
# Requires: AWS CLI (winget install Amazon.AWSCLI)

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$LocalFile,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$S3Path
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = if ($env:ENV_FILE) { $env:ENV_FILE } else { Join-Path $ProjectRoot '.env' }

function Get-EnvVar {
    param([string]$Key)

    if (-not (Test-Path $EnvFile)) { return '' }

    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$([regex]::Escape($Key))=" } | Select-Object -First 1
    if (-not $line) { return '' }

    $value = $line.Substring($line.IndexOf('=') + 1).Trim()
    if ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
    if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
    return $value
}

function Resolve-Destination {
    param([string]$RawPath)

    $bucket = if ($env:R2_BUCKET_NAME) { $env:R2_BUCKET_NAME } else { Get-EnvVar 'R2_BUCKET_NAME' }
    if (-not $bucket) { $bucket = 'imlur-games' }

    if ($RawPath -like 's3://*') { return $RawPath }

    $key = $RawPath.TrimStart('/')
    return "s3://$bucket/$key"
}

function Resolve-Credentials {
    $accessKey = if ($env:R2_UPLOAD_ACCESS_KEY_ID) { $env:R2_UPLOAD_ACCESS_KEY_ID } else { Get-EnvVar 'R2_UPLOAD_ACCESS_KEY_ID' }
    $secretKey = if ($env:R2_UPLOAD_SECRET_ACCESS_KEY) { $env:R2_UPLOAD_SECRET_ACCESS_KEY } else { Get-EnvVar 'R2_UPLOAD_SECRET_ACCESS_KEY' }

    if (-not $accessKey -or -not $secretKey) {
        $accessKey = if ($env:R2_ACCESS_KEY_ID) { $env:R2_ACCESS_KEY_ID } else { Get-EnvVar 'R2_ACCESS_KEY_ID' }
        $secretKey = if ($env:R2_SECRET_ACCESS_KEY) { $env:R2_SECRET_ACCESS_KEY } else { Get-EnvVar 'R2_SECRET_ACCESS_KEY' }
    }

    if (-not $accessKey -or -not $secretKey) {
        $accessKey = $env:AWS_ACCESS_KEY_ID
        $secretKey = $env:AWS_SECRET_ACCESS_KEY
    }

    if (-not $accessKey -or -not $secretKey) {
        throw "No R2 upload credentials found. Set R2_UPLOAD_ACCESS_KEY_ID and R2_UPLOAD_SECRET_ACCESS_KEY in .env."
    }

    $env:AWS_ACCESS_KEY_ID = $accessKey
    $env:AWS_SECRET_ACCESS_KEY = $secretKey
    if (-not $env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION = 'auto' }

    # AWS CLI v2.22+ sends checksum trailers R2 does not support (shows as SSL handshake failure).
    $env:AWS_REQUEST_CHECKSUM_CALCULATION = 'when_required'
    $env:AWS_RESPONSE_CHECKSUM_VALIDATION = 'when_required'
}

$AwsCli = (Get-Command aws -ErrorAction SilentlyContinue)?.Source
if (-not $AwsCli) {
    $defaultAws = Join-Path ${env:ProgramFiles} 'Amazon\AWSCLIV2\aws.exe'
    if (Test-Path $defaultAws) {
        $AwsCli = $defaultAws
    } else {
        throw "AWS CLI is not installed. Run: winget install Amazon.AWSCLI"
    }
}

$LocalFile = (Resolve-Path $LocalFile).Path

$accountId = if ($env:R2_ACCOUNT_ID) { $env:R2_ACCOUNT_ID } else { Get-EnvVar 'R2_ACCOUNT_ID' }
if (-not $accountId) { throw "R2_ACCOUNT_ID is not set in .env or the environment." }

Resolve-Credentials
$destination = Resolve-Destination $S3Path
$endpoint = "https://$accountId.r2.cloudflarestorage.com"

Write-Host "Uploading:"
Write-Host "  Local : $LocalFile"
Write-Host "  Target: $destination"
Write-Host "  Endpoint: $endpoint"
Write-Host ""

$awsArgs = @(
    's3', 'cp', $LocalFile, $destination,
    '--endpoint-url', $endpoint
)

& $AwsCli @awsArgs
if ($LASTEXITCODE -ne 0) {
    throw "Upload failed (aws exit code $LASTEXITCODE)."
}

$listPrefix = ($destination -replace '^s3://([^/]+)/(.+)$', 's3://$1/$2') -replace '/[^/]+$', '/'

Write-Host ""
Write-Host "Done. Verify with:"
Write-Host "  aws s3 ls `"$listPrefix`" --endpoint-url `"$endpoint`""
