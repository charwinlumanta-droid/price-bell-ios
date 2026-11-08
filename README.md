# ICC Price Bell for iPhone — GitHub edition

Install this app on an iPhone from **Safari → Share → Add to Home Screen**. A Windows PC is enough to publish it. No Mac, Xcode, Apple developer account, or App Store submission is needed for this web-app installation.

This repository contains an installable **web app**. Downloading the repository ZIP onto an iPhone does not install it. GitHub Pages supplies the secure website address Safari needs.

## 1. Make sure the website has published

If the delivery already includes a tested live app link, skip this section and open that link on your iPhone. Otherwise:

1. On Windows, sign in to the GitHub account that owns this repository.
2. Open the **price-bell-ios** repository, then **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source. This repository already includes the publishing workflow; do not add another one.
4. Open the **Actions** tab and select **Test and publish iPhone app**.
5. If no run has started, click **Run workflow**, choose **main**, then click the green **Run workflow** button. Refresh the page after a few moments.
6. Open the newest run. Wait until both **build** and **deploy** have green check marks. The engine tests must pass before publication.
7. Return to **Settings → Pages**. Click **Visit site** or copy the HTTPS address shown there. Open it and confirm the ICC logo and Price Bell controls appear.

The site address normally has this form: `https://YOUR-GITHUB-USERNAME.github.io/price-bell-ios/`.

**Use the actual address shown by GitHub only after a successful deployment and a working site check.** Keep its final slash and repository path. GitHub free accounts normally require a public repository for Pages; only application source is included here.

## 2. Install on the iPhone

Use **iOS 15.4 or later**, preferably the latest iOS your iPhone supports. To update, open iPhone **Settings → General → Software Update**.

1. Connect the iPhone to the internet and open **Safari**.
2. Enter the published HTTPS app link. Open it directly in Safari, not inside a messaging app's browser.
3. Wait until Price Bell finishes loading.
4. Tap **Share**, the square with an upward arrow. Depending on the Safari layout, first open its menu to find Share.
5. Scroll through the actions and tap **Add to Home Screen**.
6. Leave the name as **Price Bell**. If **Open as Web App** appears, keep it enabled. Tap **Add**.
7. Return to the Home Screen and tap the new ICC icon.
8. Create your targets in this installed app. A Safari tab can have a separate set of saved data.

## 3. Test your first bell

1. Open **Settings → Test alarm**. Confirm you hear it, then tap **Dismiss**. Check phone volume and speakers/headphones if needed.
2. Open **Market**, choose Deriv or Binance and a supported market, then tap **Start monitoring**.
3. Wait for a live price and a recent quote age.
4. For a simple test, choose **At or above** and a target below the current price. For example, with a current price of 100, a target of 99 can trigger on the next fresh quote at 99 or higher.
5. Tap **Add to queue**. Check **Queue**.
6. When the target triggers, tap **Dismiss**. The alert leaves **Queue** automatically and appears in saved **History** with its trigger time and observed price.
7. **Rearm** creates a fresh queued alert while keeping the original history entry. An already satisfied above/below condition may trigger again on the next fresh quote.

Tap **?** in the app to open [the illustrated beginner guide](INSTALL-ON-IPHONE.html), including Windows + Telegram setup and troubleshooting.

## Phone behavior and data

- **Keep Price Bell open for direct monitoring and sound.** Switching apps, locking the phone, or losing internet pauses the session. Reopen it and tap **Start monitoring**. Price moves during a pause can be missed.
- This package has no cloud price monitor or web-push backend. For locked-screen messages, configure targets in the existing Windows Price Bell app and connect Telegram there. The PC must stay awake, online, and monitoring.
- Queue and History stay in this site's browser storage on this device. They do not synchronize with Windows, Android, or another browser. Use **Settings → Export backup** before changing address/device or clearing data; use **Restore backup** to import it.
- The app shell can reopen offline after its first complete download. Live prices still need internet.
- Categories such as stop loss and take profit label price levels. They do not read trade fills or place orders.

## Update the app later

Publish complete source changes to **main**. The Actions workflow tests the engine and deploys the website. Keep the repository name, owner, and site address stable so the phone keeps the same site data.

For an app-shell release, change `VERSION` in `service-worker.js` before publishing. After a successful deployment, close the app's open windows and reopen it online so the new cached release can activate. Avoid clearing website data just to update; export a backup first if a reset is needed.

## Troubleshooting

- **404 / site not found:** check Settings → Pages uses GitHub Actions, then check the latest workflow has a green deploy job. Use the complete address with `/price-bell-ios/`.
- **Workflow failed:** open its red job and step to read the message. Missing Pages configuration is fixed in Settings → Pages. Failed tests need a source fix before redeploying.
- **Add to Home Screen missing:** open the website directly in Safari and scroll through Share actions. An HTML file opened from Files is not the hosted app.
- **No prices:** check internet, market/provider selection, device clock, and regional provider availability. Tap Start monitoring again.
- **No sound:** tap Test alarm to enable browser audio, check volume/audio output, and keep the app visible.
- **No alarm when locked:** direct web-app monitoring pauses. Use Windows + Telegram for messages while locked.

## For maintainers

Node.js 22 or later is enough; this project has no package dependencies.

```sh
npm test
npm run build
```

The build copies a fixed list of 13 app/guide/icon files into `dist/`. GitHub Pages receives only that folder. Repository documentation, tests, workflows, and configuration are not included in the deployed website. All application asset URLs and the manifest scope are relative, so the app works under the repository path.

The inherited web app passed 17 engine tests, 18 service-worker checks, and 38 Chromium browser checks, including saved Queue-to-History behavior and real Deriv/Binance ticks. Physical iPhone/Safari installation and speaker sound still require a test on the phone. See [VERIFICATION.txt](VERIFICATION.txt).

Official help: [GitHub Pages deployment](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [Apple Home Screen web apps](https://support.apple.com/guide/iphone/open-as-a-web-app-iphea86e5236/ios)

