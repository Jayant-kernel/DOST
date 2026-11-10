param([ValidateSet('Q2_K','Q4_K_M')][string]$Quant='Q4_K_M')
$ErrorActionPreference = 'Stop'
if (Get-Process llama-cli,llama-server -ErrorAction SilentlyContinue) { throw 'An Evon runner is already open. Close it first to avoid loading two models.' }
$ollamaModels = try { (Invoke-RestMethod 'http://127.0.0.1:11434/api/ps' -TimeoutSec 2).models } catch { @() }
if ($ollamaModels.Count -gt 0) { throw 'Ollama has a model loaded. Unload it before starting Evon; no second model was loaded.' }
$runner = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter llama-server.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (-not $runner) { throw 'Install ggml.llamacpp through winget first.' }
# Check that Windows permits the executable and its dependencies before hashing
# the large model. Native failures otherwise leave PowerShell exiting silently.
& $runner --version
if ($LASTEXITCODE -ne 0) {
  $runnerCode = '{0:X8}' -f ([long]$LASTEXITCODE -band 0xffffffffL)
  if ($runnerCode -eq 'C0E90002') {
    throw "Evon startup blocked by Windows Application Control (0x$runnerCode). Check Microsoft-Windows-CodeIntegrity/Operational for the blocked dependency. Use an administrator-approved runner package; do not disable security policy."
  }
  throw "Evon runner preflight failed (0x$runnerCode). See the local Evon startup logs."
}
$model = Join-Path $env:USERPROFILE "Downloads\gnani-evon-v3.3-30B-A3B-$Quant.gguf"
$expected = if ($Quant -eq 'Q2_K') { '464b9fe1c108018009a5b1164dc3bfd86fd111603ae388a79ae9171cb21c7cea' } else { '66569eaabe3345df11ed729c1142f8013a3dbf16189dc6bf3695e0889dca73e9' }
if ((Get-FileHash -LiteralPath $model -Algorithm SHA256).Hash -ne $expected) { throw 'Model checksum mismatch; model not loaded.' }
# Measured 2026-11-07 (tasks/prompt-cache-2026-11-07/README.md): copying the
# RAM-resident weights to the GPU for every 32+ token batch cost ~2s even for
# 50 tokens. Offload only batches of 300+ tokens, where it still pays off.
# Remove this line to restore llama.cpp's default threshold.
$env:GGML_OP_OFFLOAD_MIN_BATCH = '300'
& $runner -m $model -c 2048 -ngl 10 --host 127.0.0.1 --port 8080 --alias saathi-evon --reasoning off
if ($LASTEXITCODE -ne 0) { throw "Evon stopped with exit code $LASTEXITCODE. See the local Evon startup logs." }
