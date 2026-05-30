# FRAME PRO — Professional Video Frame Extraction Platform

> Extract exactly 50 high-quality JPEG frames from any video, entirely in your browser.

![FRAME PRO](https://img.shields.io/badge/FRAME%20PRO-v1.0.0-c9a84c?style=for-the-badge&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![FFmpeg WASM](https://img.shields.io/badge/FFmpeg-WASM-green?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite)

---

## Overview

FRAME PRO is a production-grade, browser-based video frame extraction platform. Upload any video and instantly receive exactly 50 JPEG frames distributed evenly across the full duration. No server uploads, no privacy concerns — all processing happens locally via FFmpeg compiled to WebAssembly.

---

## Features

- **Exact 50 Frames** — Algorithmically computed `fps = 50 / duration` for perfect distribution
- **100% Private** — FFmpeg WASM runs entirely in-browser; your video never leaves your device
- **4K Ready** — Handles MP4, MOV, WEBM, AVI, and MKV at any resolution
- **Professional UI** — Cinematic dark theme inspired by Adobe Premiere Pro and DaVinci Resolve
- **Drag & Drop Upload** — Click or drag to upload, with full file validation
- **Frame Gallery** — Responsive 4-column grid with lazy-loaded thumbnails
- **Lightbox Preview** — Full-screen frame preview with keyboard navigation
- **Download Single / All** — Download individual frames or a complete ZIP archive
- **Semantic Filenames** — `videoname_frame_01.jpg` … `videoname_frame_50.jpg`
- **Responsive** — Mobile, tablet, laptop, and desktop layouts
- **Accessible** — ARIA labels, keyboard navigation, focus management

---

## Screenshots

> _Add your own screenshots here after first run_

| Upload Screen | Processing | Gallery |
|---|---|---|
| _(screenshot)_ | _(screenshot)_ | _(screenshot)_ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Video Processing | FFmpeg WASM (`@ffmpeg/ffmpeg`) |
| Compression | JSZip |
| Icons | Lucide React |
| Fonts | Syne · DM Sans · JetBrains Mono |
| Hosting | Render (Static Site) |

---

## Installation & Local Development

### Prerequisites

- Node.js 18+
- npm 9+

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/frame-pro.git
cd frame-pro

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Important:** The development server sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers automatically. These are required for FFmpeg WASM to use `SharedArrayBuffer`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Deploying to GitHub

```bash
git init
git add .
git commit -m "Initial commit: FRAME PRO v1.0.0"
git remote add origin https://github.com/your-username/frame-pro.git
git branch -M main
git push -u origin main
```

---

## Deploying to Render

1. Push your code to GitHub (see above)
2. Go to [https://render.com](https://render.com) and sign in
3. Click **New → Static Site**
4. Connect your GitHub repository
5. Render will auto-detect `render.yaml` and configure:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
   - **Headers:** COOP + COEP (required for FFmpeg WASM)

> The `render.yaml` file in the root handles all configuration automatically.

---

## Project Structure

```
frame-pro/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── index.ts
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── UploadZone.tsx
│   │   ├── VideoInfo.tsx
│   │   ├── ProcessingPanel.tsx
│   │   ├── ProgressRing.tsx
│   │   ├── FrameCard.tsx
│   │   ├── FrameGallery.tsx
│   │   ├── FramePreviewModal.tsx
│   │   └── ErrorPanel.tsx
│   ├── hooks/
│   │   ├── useFrameExtractor.ts
│   │   ├── useDropZone.ts
│   │   └── useDownload.ts
│   ├── services/
│   │   ├── ffmpegService.ts
│   │   └── downloadService.ts
│   ├── pages/
│   │   └── HomePage.tsx
│   ├── utils/
│   │   ├── format.ts
│   │   └── validation.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── render.yaml
├── .gitignore
└── README.md
```

---

## Frame Extraction Logic

```
fps = TOTAL_FRAMES / video_duration_seconds
     = 50 / duration

FFmpeg command:
  -vf fps={fps} -frames:v 50 -q:v 2 frame_%02d.jpg
```

- Frames are named `frame_01.jpg` through `frame_50.jpg` internally
- Downloads are renamed to `{videoname}_frame_01.jpg` through `{videoname}_frame_50.jpg`
- `-q:v 2` is near-maximum JPEG quality in FFmpeg (scale 1–31, lower = better)

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 92+ | ✅ Full |
| Edge 92+ | ✅ Full |
| Firefox 90+ | ✅ Full |
| Safari 15.2+ | ✅ Full |

> FFmpeg WASM requires `SharedArrayBuffer`, which needs COOP/COEP headers. All headers are configured in both `vite.config.ts` (dev) and `render.yaml` (production).

---

## Future Improvements

- [ ] Custom frame count (10, 25, 50, 100)
- [ ] Frame scrubber timeline view
- [ ] Individual frame quality settings
- [ ] WebGL-accelerated thumbnail rendering
- [ ] Video preview player in-app
- [ ] Batch video processing
- [ ] Cloud storage export (Google Drive, S3)
- [ ] Metadata export (CSV with timestamp, resolution)
- [ ] PWA support for offline use

---

## License

MIT © FRAME PRO
