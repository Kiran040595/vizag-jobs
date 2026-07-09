# PWA Setup Guide for Vizag Jobs

Your application has been configured as a Progressive Web App (PWA)! Here's what you need to do to complete the setup.

## ✅ What's Already Done

- ✅ Vite PWA plugin installed and configured
- ✅ Service worker configured for offline support
- ✅ Web manifest created
- ✅ Meta tags added to HTML for mobile installation
- ✅ Cache strategy configured (Network-first with fallback)

## 📱 Install on Android

After deploying to production (via Vercel), users can install the app by:

1. Opening the app in Chrome/Samsung Internet on Android
2. Tap the menu button (⋮) → "Install app" or wait for the install prompt
3. Tap "Install" to add the app to home screen
4. The app will work offline (partially) and behave like a native app

## 🎨 Creating App Icons

The app requires 4 icon files in the `/public` folder:

### Required Icons:

1. **icon-192x192.png** - Regular 192x192px icon
2. **icon-512x512.png** - Regular 512x512px icon  
3. **icon-192x192-maskable.png** - Maskable 192x192px (for adaptive icons)
4. **icon-512x512-maskable.png** - Maskable 512x512px (for adaptive icons)

### What are Maskable Icons?

Maskable icons are used for Android adaptive icons. The icon should have a safe zone - keep important content within the center circle (about 80px for 192x192 and 210px for 512x512).

### How to Create Icons

**Option 1: Quick Setup with AI Tools**
- Use https://www.pwabuilder.com/ - Upload a logo and it generates all icon sizes
- Download the icons and place them in `/public`

**Option 2: Online Icon Generator**
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/

**Option 3: Manual Creation with Design Tool**
- Use Figma, Adobe XD, or Photoshop to create a 512x512px icon
- Export at: 192x192, 512x512 (regular and maskable variants)
- Save as PNG with transparency

**Option 4: Using NodeJS (requires canvas)**

```bash
npm install canvas sharp
node scripts/generate-pwa-icons.js
```

## 📸 App Screenshots

Add screenshots for better app store visibility:

- `/public/screenshot1.png` - 540x720px (portrait)
- `/public/screenshot2.png` - 540x720px (portrait)

These are displayed when users install the app on Android.

## ⚙️ Configuration Files

### manifest.json
- Located at `/public/manifest.json`
- Defines app name, icons, colors, and install behavior
- Customize with your branding colors: `theme_color`, `background_color`

### Service Worker
- Automatically handled by Vite PWA plugin
- Default location: Generated at build time
- Custom location: `/public/service-worker.js`

## 🔧 Offline Support

The app now supports:
- ✅ Offline browsing of cached pages
- ✅ Network-first strategy for API calls (API calls try network first, then cache)
- ✅ Automatic cache updates
- ✅ Stale cache cleanup

API calls are cached for **1 hour** (adjustable in `vite.config.js`).

## 🚀 Build and Deploy

```bash
# Build with PWA support
npm run build

# Preview
npm run preview

# Deploy to Vercel (HTTPS required for PWA to work)
vercel deploy
```

## ✨ Features You Get with PWA

1. **Installable** - Users can install the app on home screen
2. **Works Offline** - Uses cached content when offline
3. **App-like** - Shows in fullscreen mode (no browser chrome)
4. **Faster Loads** - Service worker caches assets
5. **Push Notifications** - Can add later with Web Push API
6. **Responsive** - One codebase works on all devices

## 🐛 Testing

### Test on Desktop
1. `npm run dev`
2. Open DevTools → Application → Service Workers
3. Check "Offline" to simulate offline mode
4. Try navigating around - cached pages should load

### Test on Android
1. Deploy to Vercel with HTTPS
2. Open in Chrome
3. Tap menu → "Install app"
4. Test offline functionality

## ❓ Troubleshooting

**App won't install on Android**
- Ensure you're using HTTPS (not HTTP)
- Check that manifest.json is valid
- Browser might need to be refreshed

**Service worker not updating**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear cache in DevTools Application tab

**Icons not showing**
- Verify icon files are in `/public` folder
- Check file names match exactly in manifest.json
- Ensure icons are valid PNG files

## 📚 Useful Links

- [MDN - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev - PWA Checklist](https://web.dev/pwa-checklist/)
- [PWABuilder](https://www.pwabuilder.com/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 📋 PWA Checklist

- [ ] Create and add app icons (icon-*.png)
- [ ] Create and add screenshots (screenshot*.png)
- [ ] Customize manifest.json with your brand colors
- [ ] Test on desktop browser (DevTools → Application)
- [ ] Deploy to production with HTTPS
- [ ] Test installation on Android device/emulator
- [ ] Test offline functionality
- [ ] Test various network conditions (throttling)

---

Your PWA is ready to go! 🎉 Create the icon files, deploy, and users can install it on their Android phones!
