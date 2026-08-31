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
  'docs/index.html',
  'docs/content/manual.md',
  'docs/content/faq.md',
  'docs/content/changelog/v1.0.1.md',
  'docs/content/changelog/v2.0.0.md',
  'docs/manual/index.html',
  'docs/faq/index.html',
  'docs/changelog/index.html',
  'docs/changelog/v1.0.1/index.html',
  'docs/changelog/v2.0.0/index.html',
  'docs/assets/docs.js',
  'docs/assets/home-particle-scroll.js',
  'docs/assets/particle-scroll.js',
  'docs/assets/canvas-ui-LICENSE.md',
  'docs/assets/manual/README.md'
)

foreach ($file in $requiredFiles) {
  Assert-FileExists $file
}

$manualTitle = '# ClipKnife ' + [string]([char]0x4F7F) + [string]([char]0x7528) + [string]([char]0x624B) + [string]([char]0x518C)
$faqTitle = '# ClipKnife ' + [string]([char]0x5E38) + [string]([char]0x89C1) + [string]([char]0x95EE) + [string]([char]0x9898)
$memoryRequirement = [string]([char]0x8FD0) + [string]([char]0x884C) + [string]([char]0x5185) + [string]([char]0x5B58) + [string]([char]0xFF1A) + '16GB ' + [string]([char]0x53CA) + [string]([char]0x4EE5) + [string]([char]0x4E0A)
$minimumMemoryRequirement = [string]([char]0x8FD0) + [string]([char]0x884C) + [string]([char]0x5185) + [string]([char]0x5B58) + [string]([char]0x81F3) + [string]([char]0x5C11) + [string]([char]0x9700) + [string]([char]0x8981) + ' 16GB'

Assert-TextContains 'docs/index.html' 'href="manual/"'
Assert-TextContains 'docs/index.html' 'href="changelog/"'
Assert-TextContains 'docs/index.html' 'href="faq/"'
Assert-TextContains 'docs/index.html' 'id="creation"'
Assert-TextContains 'docs/index.html' 'id="assistantTitle"'
Assert-TextContains 'docs/index.html' 'id="toolboxTitle"'
Assert-TextContains 'docs/index.html' 'Real-ESRGAN'
Assert-TextContains 'docs/index.html' 'Video2X'
Assert-TextContains 'docs/index.html' '50,000'
Assert-TextContains 'docs/index.html' $memoryRequirement
Assert-TextContains 'docs/index.html' '"memoryRequirements": "16 GB RAM or more"'
Assert-TextContains 'docs/faq/index.html' $minimumMemoryRequirement
Assert-TextContains 'docs/index.html' 'http-equiv="origin-trial"'
Assert-TextContains 'docs/index.html' 'src="assets/home-particle-scroll.js"'
Assert-TextContains 'docs/assets/home-particle-scroll.js' 'supportsHtmlInCanvas'
Assert-TextContains 'docs/assets/home-particle-scroll.js' '(max-width: 767px)'

$homeContent = Get-Content -Raw -Encoding UTF8 -LiteralPath 'docs/index.html'
$originTrialMatch = [regex]::Match(
  $homeContent,
  'http-equiv="origin-trial"\s+content="([^"]+)"'
)
if (-not $originTrialMatch.Success) {
  throw 'Expected a valid Origin Trial meta token on the homepage'
}
$originTrialPayload = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String($originTrialMatch.Groups[1].Value)
)
if (-not $originTrialPayload.Contains('https://clipknife.cn:443')) {
  throw 'Origin Trial token is not bound to https://clipknife.cn:443'
}

$nonHomePages = @(
  'docs/manual/index.html',
  'docs/faq/index.html',
  'docs/changelog/index.html',
  'docs/changelog/v1.0.1/index.html',
  'docs/changelog/v2.0.0/index.html'
)

foreach ($page in $nonHomePages) {
  $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $page
  if ($content.Contains('home-particle-scroll.js')) {
    throw "Particle Scroll must only load on the homepage: $page"
  }
  if ($content.Contains('http-equiv="origin-trial"')) {
    throw "Origin Trial token must only load on the homepage: $page"
  }
}

# Keep published download destinations stable while changing feature copy.
Assert-TextContains 'docs/index.html' 'releases/download/v1.1.6/'
Assert-TextContains 'docs/index.html' 'pan.baidu.com/s/1jdUj8FZCE7Td8KqfQAQ3PQ?pwd=kjkc'
Assert-TextContains 'docs/index.html' 'pan.quark.cn/s/926965d6ffe4?pwd=YV71'
Assert-TextContains 'docs/index.html' 'github.com/qianqianhaiou/ClipKnife/releases/tag/v1.0.1'

Assert-TextContains 'docs/manual/index.html' 'data-doc-src="../content/manual.md"'
Assert-TextContains 'docs/faq/index.html' 'data-doc-src="../content/faq.md"'
Assert-TextContains 'docs/changelog/v1.0.1/index.html' 'data-doc-src="../../content/changelog/v1.0.1.md"'
Assert-TextContains 'docs/changelog/v2.0.0/index.html' 'data-doc-src="../../content/changelog/v2.0.0.md"'
Assert-TextContains 'docs/changelog/index.html' 'href="v2.0.0/"'
Assert-TextContains 'docs/sitemap.xml' 'https://clipknife.cn/changelog/v2.0.0/'

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
Assert-TextContains 'docs/assets/manual/README.md' '10-creative-assistant.png'
Assert-TextContains 'docs/assets/manual/README.md' '15-toolbox-video-enhance.png'
Assert-TextContains 'docs/content/changelog/v1.0.1.md' '# v1.0.1'
Assert-TextContains 'docs/content/changelog/v1.0.1.md' '2026-06-24'
Assert-TextContains 'docs/content/changelog/v2.0.0.md' '# v2.0.0'
Assert-TextContains 'docs/content/changelog/v2.0.0.md' 'Openverse'
Assert-TextContains 'docs/content/changelog/v2.0.0.md' 'Real-ESRGAN'
Assert-TextContains 'docs/content/changelog/v2.0.0.md' 'Video2X'
Assert-TextContains 'docs/content/changelog/v2.0.0.md' '50,000'
Assert-TextContains 'docs/content/changelog/v2.0.0.md' 'Vulkan'

& node --test 'tests/docs-anchor.test.cjs'
if ($LASTEXITCODE -ne 0) {
  throw "Documentation anchor tests failed with exit code $LASTEXITCODE"
}

Write-Host 'docs-site validation passed'
