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
  'manual/product-baseline.md',
  'docs/index.html',
  'docs/content/manual.md',
  'docs/content/faq.md',
  'docs/content/changelog/v1.0.1.md',
  'docs/manual/index.html',
  'docs/faq/index.html',
  'docs/changelog/index.html',
  'docs/changelog/v1.0.1/index.html',
  'docs/assets/docs.js',
  'docs/assets/manual/README.md'
)

foreach ($file in $requiredFiles) {
  Assert-FileExists $file
}

$manualTitle = '# ClipKnife ' + [string]([char]0x4F7F) + [string]([char]0x7528) + [string]([char]0x624B) + [string]([char]0x518C)
$faqTitle = '# ClipKnife ' + [string]([char]0x5E38) + [string]([char]0x89C1) + [string]([char]0x95EE) + [string]([char]0x9898)

Assert-TextContains 'docs/index.html' 'href="manual/"'
Assert-TextContains 'docs/index.html' 'href="changelog/"'
Assert-TextContains 'docs/index.html' 'href="faq/"'
Assert-TextContains 'docs/index.html' 'id="creation"'
Assert-TextContains 'docs/index.html' 'id="assistantTitle"'
Assert-TextContains 'docs/index.html' 'id="toolboxTitle"'
Assert-TextContains 'docs/index.html' 'Real-ESRGAN'
Assert-TextContains 'docs/index.html' 'Video2X'
Assert-TextContains 'docs/index.html' '50,000'

# Keep published download destinations stable while changing feature copy.
Assert-TextContains 'docs/index.html' 'releases/download/v1.1.6/'
Assert-TextContains 'docs/index.html' 'pan.baidu.com/s/1jdUj8FZCE7Td8KqfQAQ3PQ?pwd=kjkc'
Assert-TextContains 'docs/index.html' 'pan.quark.cn/s/926965d6ffe4?pwd=YV71'
Assert-TextContains 'docs/index.html' 'github.com/qianqianhaiou/ClipKnife/releases/tag/v1.0.1'

Assert-TextContains 'docs/manual/index.html' 'data-doc-src="../content/manual.md"'
Assert-TextContains 'docs/faq/index.html' 'data-doc-src="../content/faq.md"'
Assert-TextContains 'docs/changelog/v1.0.1/index.html' 'data-doc-src="../../content/changelog/v1.0.1.md"'

Assert-TextContains 'docs/assets/docs.js' 'function renderMarkdown'
Assert-TextContains 'docs/assets/docs.js' 'data-doc-src'
Assert-TextContains 'docs/assets/docs.js' 'function scrollToLocationHash'

Assert-TextContains 'docs/content/manual.md' $manualTitle
Assert-TextContains 'docs/content/manual.md' '../assets/manual/01-first-launch.png'
Assert-TextContains 'docs/content/manual.md' 'Openverse'
Assert-TextContains 'docs/content/manual.md' 'OpenAI Compatible'
Assert-TextContains 'docs/content/manual.md' 'Real-ESRGAN'
Assert-TextContains 'docs/content/manual.md' 'Video2X'
Assert-TextContains 'docs/content/faq.md' $faqTitle
Assert-TextContains 'docs/content/faq.md' '../assets/manual/08-diagnostics.png'
Assert-TextContains 'docs/content/faq.md' 'Openverse'
Assert-TextContains 'docs/content/faq.md' 'OpenAI Compatible'
Assert-TextContains 'docs/content/faq.md' 'Real-ESRGAN'
Assert-TextContains 'docs/content/faq.md' 'Video2X'
Assert-TextContains 'manual/product-baseline.md' '### 3.10 '
Assert-TextContains 'manual/product-baseline.md' '### 3.11 '
Assert-TextContains 'manual/product-baseline.md' 'Freesound'
Assert-TextContains 'docs/assets/manual/README.md' '10-creative-assistant.png'
Assert-TextContains 'docs/assets/manual/README.md' '15-toolbox-video-enhance.png'
Assert-TextContains 'docs/content/changelog/v1.0.1.md' '# v1.0.1'
Assert-TextContains 'docs/content/changelog/v1.0.1.md' '2026-06-24'

& node --test 'tests/docs-anchor.test.cjs'
if ($LASTEXITCODE -ne 0) {
  throw "Documentation anchor tests failed with exit code $LASTEXITCODE"
}

Write-Host 'docs-site validation passed'
