$ErrorActionPreference = 'Stop'

function Assert-FileExists {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Expected file to exist: $Path"
  }
}

function Assert-TextContains {
  param(
    [string]$Path,
    [string]$Expected
  )
  $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path
  if (-not $content.Contains($Expected)) {
    throw "Expected '$Path' to contain '$Expected'"
  }
}

$requiredFiles = @(
  'docs/content/manual.md',
  'docs/content/faq.md',
  'docs/content/changelog/v1.0.1.md',
  'docs/manual/index.html',
  'docs/faq/index.html',
  'docs/changelog/index.html',
  'docs/changelog/v1.0.1/index.html',
  'docs/assets/docs.js'
)

foreach ($file in $requiredFiles) {
  Assert-FileExists $file
}

$manualTitle = '# ClipKnife ' + [string]([char]0x4F7F) + [string]([char]0x7528) + [string]([char]0x624B) + [string]([char]0x518C)
$faqTitle = '# ClipKnife ' + [string]([char]0x5E38) + [string]([char]0x89C1) + [string]([char]0x95EE) + [string]([char]0x9898)

Assert-TextContains 'docs/index.html' 'href="manual/"'
Assert-TextContains 'docs/index.html' 'href="changelog/"'
Assert-TextContains 'docs/index.html' 'href="faq/"'

Assert-TextContains 'docs/manual/index.html' 'data-doc-src="../content/manual.md"'
Assert-TextContains 'docs/faq/index.html' 'data-doc-src="../content/faq.md"'
Assert-TextContains 'docs/changelog/v1.0.1/index.html' 'data-doc-src="../../content/changelog/v1.0.1.md"'

Assert-TextContains 'docs/assets/docs.js' 'function renderMarkdown'
Assert-TextContains 'docs/assets/docs.js' 'data-doc-src'

Assert-TextContains 'docs/content/manual.md' $manualTitle
Assert-TextContains 'docs/content/manual.md' '../assets/manual/01-first-launch.png'
Assert-TextContains 'docs/content/faq.md' $faqTitle
Assert-TextContains 'docs/content/faq.md' '../assets/faq/01-diagnostics.png'
Assert-TextContains 'docs/content/changelog/v1.0.1.md' '# v1.0.1'
Assert-TextContains 'docs/content/changelog/v1.0.1.md' '2026-06-24'

Write-Host 'docs-site validation passed'
