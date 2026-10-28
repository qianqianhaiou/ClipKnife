# ClipKnife（素刀）

> Find images and video moments on your own drives by describing what you remember.
>
> [中文](./README.md) | English

ClipKnife is a Windows desktop app for local media management and natural-language search. Add folders or external drives, build the local index, then describe a scene to find relevant images or video shots. Open the original media to check each result before using it.

**This repository contains the website, documentation, release notes and issue tracker. It does not contain the desktop application source code.** Download the app from the official website; cloning this repository or setting up a development toolchain is not required.

- [Official download](https://clipknife.cn/)
- [User manual](https://clipknife.cn/manual/) · [FAQ](https://clipknife.cn/faq/) · [Release notes](https://clipknife.cn/changelog/) — currently in Chinese
- [Finding local videos by their content](https://clipknife.cn/scenes/search-video-content/)

## When it helps

- You remember a scene but not a filename: for example, “sunset by the sea” or “red product close-up”. These illustrate query styles, not measured success rates.
- Media is scattered across folders, projects and drives.
- You need to locate a shot within a long video, rather than just find the file.
- You want to organize found media into a project or continue editing in another application.

ClipKnife is not a full video editor. It does not provide cloud synchronization or collaborative online editing. Representative frames can miss brief events, and automatic grouping or classification can be wrong; review the source media yourself.

## Basic workflow

1. Install the official download, complete online activation, and initialize the required components.
2. Start with a small folder and confirm that its files are accessible before adding more sources.
3. Wait for scanning and indexing. Images enter the visual index; videos are divided into shots with representative frames linked to source time ranges. Initial indexing time depends on the media and hardware.
4. Search using a description or an image. For spoken-content search, enable the relevant transcription option and let its index finish first.
5. Play the matching shot to confirm it, then open the original file, export clips or organize results into a project. Check the documented versions and target timeline before sending media to Jianying or Premiere Pro.

## Features and limits

| Area | Available workflow | Important limit |
|---|---|---|
| Local library | Manage image, video and audio sources and inspect scanning/indexing tasks | Original files may be unavailable when their drive or source is offline |
| Visual search | Find local images and video shots using natural language or an image | Requires a completed index; it does not examine every video frame or guarantee a match |
| Speech search | Search transcribed speech with corresponding time ranges | Audio and video transcription are separate options, both disabled by default; first use downloads components |
| Video shots | Preview shots, edit their tags and export selected or all clips | The shot editor supports tag editing only: no notes, manual boundary changes, merging, splitting or deleting shots |
| Project management | Organize found media and shots into a working collection | Not a cloud collaboration project; shared-library results cannot be added directly to a local project |
| Creative assistant | Organize media, generate text or voice-over, and create or edit Jianying drafts | Requires a configured model service; inspect and export the final video in Jianying, not directly from the assistant |
| Toolbox | Text-to-speech, image upscaling, video enhancement and batch video shot export | Install the required tools/components; automatic batch shot export is separate from manual shot editing |
| LAN sharing | Read-only search and use of media published by another computer on a trusted LAN | Disabled by default; the host must stay running with a valid license and accessible media; this is not cloud sync |

“Add to Jianying / PR” sends one local image, whole video or shot at a time to an existing timeline. It does not create a draft, project or sequence, and does not add shared-library media directly. See the [v2.4.0 release notes](https://clipknife.cn/changelog/v2.4.0/) for supported versions and connector requirements; support has not been verified for every editor version.

## System requirements

The current public download targets **Windows 10 (version 1809 or later) or Windows 11, both x64**, with **at least 16GB RAM**. There are no macOS or Linux installers. Refer to the official download page for current requirements.

- **Core local search can run on a CPU**; compatible GPUs can accelerate it. This does not mean every optional feature supports CPU execution.
- **Local visual description** requires a compatible NVIDIA GPU with at least 4GB VRAM, with 6GB recommended, and has no CPU inference. The current CUDA 13 components require compute capability 7.5 or newer and a Windows driver of at least 580.88. Older incompatible cards cannot run this local vision component. These NVIDIA requirements do not apply to CPU or AMD core-search components.
- **Image and video enhancement** require a Vulkan-capable GPU. CPU support for core search does not extend to these tools.

Components, indexes and media processing require additional disk space. Actual compatibility depends on the release and component checks; no processing-speed or search-accuracy guarantees are made.

## Privacy and connectivity

**Local-first does not mean every feature is fully offline.**

- **Local processing:** core indexing, search, shot detection and transcription with installed components run on your computer. These operations do not upload original media to ClipKnife's public service.
- **LAN sharing:** disabled by default and intended only for trusted local networks. It uses unencrypted HTTP. Search text, images explicitly selected for search, previews and requested original files travel between the two computers, not through ClipKnife's public service. Do not expose the sharing port to the public internet.
- **External models:** when an external vision API is enabled, selected images or sampled video frames are sent to your configured provider. A remote creative model receives relevant conversation and description text. These are not offline-only features.
- **Product services:** online activation, license verification, update checks, notifications and component downloads need access to their services. Confirm that the required license and components are available before use.

See the [manual](https://clipknife.cn/manual/) for detailed controls and data-transfer boundaries.

## Download, pricing and feedback

ClipKnife is currently free during its public beta. Future pricing and licensing follow the official website. Check the [release notes](https://clipknife.cn/changelog/) for the current version and changes.

Report problems through [GitHub Issues](https://github.com/qianqianhaiou/ClipKnife/issues). Include the app and Windows versions, relevant hardware, reproduction steps, expected and actual behavior, and redacted diagnostics where useful.

Do not post API keys, activation credentials, private media or unredacted personal paths in public issues.
