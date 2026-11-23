<!--
SPDX-FileCopyrightText: GSConnect Developers https://github.com/GSConnect

SPDX-License-Identifier: GPL-2.0-or-later
-->

# GSConnect

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">][ego] [<img alt="Available in the Chrome Web Store" src="https://raw.githubusercontent.com/GSConnect/gnome-shell-extension-gsconnect/main/data/images/chrome-badge.png" align="middle" hspace="12"/>][chrome] [<img src="https://raw.githubusercontent.com/GSConnect/gnome-shell-extension-gsconnect/main/data/images/firefox-badge.png" alt="Get the Add-On" align="middle">][firefox]

## Overview

[GSConnect][ego] is a complete implementation of [KDE Connect][kdeconnect]
especially for GNOME Shell with Nautilus, [Chrome][chrome] and
[Firefox][firefox] integration. The KDE Connect team has applications for Linux,
BSD, Android, Sailfish, iOS, macOS and Windows.

With GSConnect you can securely connect to mobile devices and other desktops to:

* Share files, links and text
* Send and receive messages
* Sync clipboard content
* Sync contacts
* Sync notifications
* Control media players
* Control system volume
* Execute predefined commands
* And more…

Please see the **[Wiki][wiki]** for more information about
**[Features][features]** and **[Help][help]**.

## Fork changes: scrcpy screen share on incoming calls

This is a personal fork of GSConnect (based on v74) that adds one feature to
the Telephony plugin. All changes are in `src/service/plugins/telephony.js` on
the `scrcpy-on-call` branch; nothing else is modified.

When a call rings (or is ongoing) **and an ADB device is connected** (USB or
wireless), the call notification gains:

* A **Screen Share** button next to **Mute**
* A default click action: clicking the notification opens a dialog with
  **Start** and **Cancel** buttons and an **Audio** switch (off by default,
  which runs scrcpy with `--no-audio`)

**Start** launches `scrcpy -s <serial>` for the connected device. If no ADB
device is connected, adb is missing, or the check takes longer than 3 seconds,
the notification is exactly the same as upstream.

Requirements: `adb` on your `PATH` and `scrcpy` installed. scrcpy is looked up
at `~/bin/scrcpy_dir/scrcpy`, then `~/.local/bin/scrcpy`, then on your `PATH`.
A user-installed build is preferred because some system builds (e.g. SDL3) draw
the window without a title bar on Wayland.

To try it, copy `src/service/plugins/telephony.js` over the same file in your
installed extension
(`~/.local/share/gnome-shell/extensions/gsconnect@andyholmes.github.io/service/plugins/`)
and restart the GSConnect service. Back up the original first.

## Project Status

GSConnect is now under the GitHub organisation [GSConnect][gsconnect-org].

Please note, this project has migrated from a developer-driven model to a
community-driven model. This means that GSConnect does not have dedicated
developers working on new features or bug fixes. Instead, the project relies on
contributions from its users and distributions that choose to package it.

If you would like to take a more active role in the development and maintenance
of GSConnect, you can start by [triaging new issues][issues],
[fixing confirmed issues][help-wanted] and [reviewing contributions][needs-review].
If you need additional permissions, you may request them from one of the
[current maintainers][people].

## Nightly Builds

For early updaters of GNOME Shell and those that wish to test the upcoming version
of GSConnect, there are automated builds available for [download][nightly-build].
See [Installing from Nightly Build][nightly-install] for installation instructions.

[ego]: https://extensions.gnome.org/extension/1319/gsconnect/
[chrome]: https://chrome.google.com/webstore/detail/gsconnect/jfnifeihccihocjbfcfhicmmgpjicaec
[firefox]: https://addons.mozilla.org/firefox/addon/gsconnect/
[kdeconnect]: https://userbase.kde.org/KDEConnect
[wiki]: https://github.com/GSConnect/gnome-shell-extension-gsconnect/wiki/
[features]: https://github.com/GSConnect/gnome-shell-extension-gsconnect/wiki/Features
[help]: https://github.com/GSConnect/gnome-shell-extension-gsconnect/wiki/Help

[gsconnect-org]: https://github.com/GSConnect
[issues]: https://github.com/GSConnect/gnome-shell-extension-gsconnect/issues
[help-wanted]: https://github.com/GSConnect/gnome-shell-extension-gsconnect/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22
[needs-review]: https://github.com/GSConnect/gnome-shell-extension-gsconnect/pulls?q=is%3Apr+is%3Aopen+label%3A%22needs+review%22
[people]: https://github.com/orgs/GSConnect/people
[nightly-build]: https://nightly.link/GSConnect/gnome-shell-extension-gsconnect/workflows/main/main/gsconnect@andyholmes.github.io.zip
[nightly-install]: https://github.com/GSConnect/gnome-shell-extension-gsconnect/wiki/Installation#install-from-nightly-build
