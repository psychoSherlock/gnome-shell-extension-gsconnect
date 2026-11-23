// SPDX-FileCopyrightText: GSConnect Developers https://github.com/GSConnect
//
// SPDX-License-Identifier: GPL-2.0-or-later

import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Components from '../components/index.js';
import * as Core from '../core.js';
import Plugin from '../plugin.js';


export const Metadata = {
    label: _('Telephony'),
    description: _('Be notified about calls and adjust system volume during ringing/ongoing calls'),
    id: 'org.gnome.Shell.Extensions.GSConnect.Plugin.Telephony',
    incomingCapabilities: [
        'kdeconnect.telephony',
    ],
    outgoingCapabilities: [
        'kdeconnect.telephony.request',
        'kdeconnect.telephony.request_mute',
    ],
    actions: {
        muteCall: {
            // TRANSLATORS: Silence the actively ringing call
            label: _('Mute Call'),
            icon_name: 'audio-volume-muted-symbolic',

            parameter_type: null,
            incoming: ['kdeconnect.telephony'],
            outgoing: ['kdeconnect.telephony.request_mute'],
        },
        scrcpyDialog: {
            // TRANSLATORS: Mirror the phone screen with scrcpy
            label: _('Screen Share (scrcpy)'),
            icon_name: 'video-display-symbolic',

            parameter_type: null,
            incoming: ['kdeconnect.telephony'],
            outgoing: [],
        },
    },
};


/**
 * Telephony Plugin
 * https://github.com/KDE/kdeconnect-kde/tree/master/plugins/telephony
 * https://github.com/KDE/kdeconnect-android/tree/master/src/org/kde/kdeconnect/Plugins/TelephonyPlugin
 */
const TelephonyPlugin = GObject.registerClass({
    GTypeName: 'GSConnectTelephonyPlugin',
}, class TelephonyPlugin extends Plugin {

    _init(device) {
        super._init(device, 'telephony');

        // Neither of these are crucial for the plugin to work
        this._mpris = Components.acquire('mpris');
        this._mixer = Components.acquire('pulseaudio');
    }

    handlePacket(packet) {
        switch (packet.type) {
            case 'kdeconnect.telephony':
                this._handleEvent(packet);
                break;
        }
    }

    /**
     * Change volume, microphone and media player state in response to an
     * incoming or answered call.
     *
     * @param {string} eventType - 'ringing' or 'talking'
     */
    _setMediaState(eventType) {
        // Mixer Volume
        if (this._mixer !== undefined) {
            switch (this.settings.get_string(`${eventType}-volume`)) {
                case 'restore':
                    this._mixer.restore();
                    break;

                case 'lower':
                    this._mixer.lowerVolume();
                    break;

                case 'mute':
                    this._mixer.muteVolume();
                    break;
            }

            if (eventType === 'talking' && this.settings.get_boolean('talking-microphone'))
                this._mixer.muteMicrophone();
        }

        // Media Playback
        if (this._mpris && this.settings.get_boolean(`${eventType}-pause`))
            this._mpris.pauseAll();
    }

    /**
     * Restore volume, microphone and media player state (if changed), making
     * sure to unpause before raising volume.
     *
     * TODO: there's a possibility we might revert a media/mixer state set for
     *       another device.
     */
    _restoreMediaState() {
        // Media Playback
        if (this._mpris)
            this._mpris.unpauseAll();

        // Mixer Volume
        if (this._mixer)
            this._mixer.restore();
    }

    /**
     * Load a Gdk.Pixbuf from base64 encoded data
     *
     * @param {string} data - Base64 encoded JPEG data
     * @returns {GdkPixbuf.Pixbuf|null} A contact photo
     */
    _getThumbnailPixbuf(data) {
        const loader = new GdkPixbuf.PixbufLoader();

        try {
            data = GLib.base64_decode(data);
            loader.write(data);
            loader.close();
        } catch (e) {
            debug(e, this.device.name);
        }

        return loader.get_pixbuf();
    }

    /**
     * Handle a telephony event (ringing, talking), showing or hiding a
     * notification and possibly adjusting the media/mixer state.
     *
     * @param {Core.Packet} packet - A `kdeconnect.telephony`
     */
    _handleEvent(packet) {
        // Only handle 'ringing' or 'talking' events; leave the notification
        // plugin to handle 'missedCall' since they're often repliable
        if (!['ringing', 'talking'].includes(packet.body.event))
            return;

        // This is the end of a telephony event
        if (packet.body.isCancel)
            this._cancelEvent(packet);
        else
            this._notifyEvent(packet);
    }

    _cancelEvent(packet) {
        // Ensure we have a sender
        // TRANSLATORS: No name or phone number
        let sender = _('Unknown Contact');

        if (packet.body.contactName)
            sender = packet.body.contactName;
        else if (packet.body.phoneNumber)
            sender = packet.body.phoneNumber;

        this._pending?.delete(`${packet.body.event}|${sender}`);
        this.device.hideNotification(`${packet.body.event}|${sender}`);
        this._restoreMediaState();
    }

    _notifyEvent(packet) {
        let body;
        let buttons = [];
        let icon = null;
        let priority = Gio.NotificationPriority.NORMAL;

        // Ensure we have a sender
        // TRANSLATORS: No name or phone number
        let sender = _('Unknown Contact');

        if (packet.body.contactName)
            sender = packet.body.contactName;
        else if (packet.body.phoneNumber)
            sender = packet.body.phoneNumber;

        // If there's a photo, use it as the notification icon
        if (packet.body.phoneThumbnail)
            icon = this._getThumbnailPixbuf(packet.body.phoneThumbnail);

        if (icon === null)
            icon = new Gio.ThemedIcon({name: 'call-start-symbolic'});

        // Notify based based on the event type
        if (packet.body.event === 'ringing') {
            this._setMediaState('ringing');

            // TRANSLATORS: The phone is ringing
            body = _('Incoming call');
            buttons = [{
                action: 'muteCall',
                // TRANSLATORS: Silence the actively ringing call
                label: _('Mute'),
                parameter: null,
            }];
            priority = Gio.NotificationPriority.URGENT;
        }

        if (packet.body.event === 'talking') {
            this.device.hideNotification(`ringing|${sender}`);
            this._setMediaState('talking');

            // TRANSLATORS: A phone call is active
            body = _('Ongoing call');
        }

        const id = `${packet.body.event}|${sender}`;
        const params = {
            id: id,
            title: sender,
            body: body,
            icon: icon,
            priority: priority,
            buttons: buttons,
        };

        // Only offer screen sharing if an ADB device is connected. The check
        // is asynchronous and falls back to the plain notification.
        this._pending ??= new Set();
        this._pending.add(id);

        this._getAdbSerial().then(serial => {
            if (!this._pending?.delete(id))
                return; // cancelled while checking

            if (serial !== null) {
                this._adbSerial = serial;
                params.action = {name: 'scrcpyDialog', parameter: null};
                params.buttons = [...buttons, {
                    action: 'scrcpyDialog',
                    label: _('Screen Share'),
                    parameter: null,
                }];
            }

            this.device.showNotification(params);
        }).catch(e => {
            logError(e);
            if (this._pending?.delete(id))
                this.device.showNotification(params);
        });
    }

    /**
     * Resolve the serial of the first connected ADB device (USB or wireless),
     * or null if there is none, adb is missing or the check times out.
     *
     * @returns {Promise<string|null>} A device serial or null
     */
    async _getAdbSerial() {
        try {
            const proc = new Gio.Subprocess({
                argv: ['adb', 'devices'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE |
                       Gio.SubprocessFlags.STDERR_SILENCE,
            });
            proc.init(null);

            const cancellable = new Gio.Cancellable();
            const timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                cancellable.cancel();
                proc.force_exit();
                return GLib.SOURCE_REMOVE;
            });

            let stdout;
            try {
                [stdout] = await proc.communicate_utf8_async(null, cancellable);
            } finally {
                GLib.source_remove(timeout);
            }

            for (const line of (stdout ?? '').split('\n')) {
                const [serial, state] = line.trim().split(/\s+/);

                if (state === 'device')
                    return serial;
            }
        } catch (e) {
            // adb not installed, timed out, etc.
        }

        return null;
    }

    _findScrcpy() {
        // Prefer a user-installed build (matches what the shell alias runs)
        // over the system one, which may render without window decorations.
        const home = GLib.get_home_dir();
        const candidates = [
            GLib.build_filenamev([home, 'bin', 'scrcpy_dir', 'scrcpy']),
            GLib.build_filenamev([home, '.local', 'bin', 'scrcpy']),
        ];

        return candidates.find(path =>
            GLib.file_test(path, GLib.FileTest.IS_EXECUTABLE)) ??
            GLib.find_program_in_path('scrcpy');
    }

    /**
     * Ask whether to start screen sharing, with an audio toggle.
     */
    scrcpyDialog() {
        if (this._scrcpyDialog) {
            this._scrcpyDialog.present();
            return;
        }

        const dialog = new Gtk.MessageDialog({
            message_type: Gtk.MessageType.QUESTION,
            text: _('Start screen share?'),
            secondary_text: _('Mirror %s with scrcpy.').format(this.device.name),
            modal: false,
            urgency_hint: true,
        });
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Start'), Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.OK);

        const row = new Gtk.Box({spacing: 12, margin_top: 6});
        row.pack_start(new Gtk.Label({label: _('Audio'), hexpand: true, xalign: 0}), true, true, 0);
        const audio = new Gtk.Switch({active: false, valign: Gtk.Align.CENTER});
        row.pack_end(audio, false, false, 0);
        dialog.get_message_area().pack_start(row, false, false, 0);
        row.show_all();

        dialog.connect('response', (_dialog, response) => {
            const withAudio = audio.active;
            dialog.destroy();
            this._scrcpyDialog = null;

            if (response === Gtk.ResponseType.OK)
                this._startScrcpy(withAudio);
        });

        this._scrcpyDialog = dialog;
        dialog.set_keep_above(true);
        dialog.present();
    }

    _startScrcpy(withAudio) {
        try {
            const scrcpy = this._findScrcpy();

            if (scrcpy === null)
                throw new Error('scrcpy not found');

            const argv = [scrcpy];

            if (this._adbSerial)
                argv.push('-s', this._adbSerial);

            if (!withAudio)
                argv.push('--no-audio');

            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (e) {
            logError(e, 'GSConnect: failed to start scrcpy');
            this.device.showNotification({
                id: 'scrcpy-error',
                title: _('Screen Share'),
                body: _('Could not start scrcpy'),
                icon: new Gio.ThemedIcon({name: 'dialog-error-symbolic'}),
            });
        }
    }

    /**
     * Silence an incoming call and restore the previous mixer/media state, if
     * applicable.
     */
    muteCall() {
        this.device.sendPacket({
            type: 'kdeconnect.telephony.request_mute',
            body: {},
        });

        this._restoreMediaState();
    }

    destroy() {
        this._pending?.clear();
        this._scrcpyDialog?.destroy();

        if (this._mixer !== undefined)
            this._mixer = Components.release('pulseaudio');

        if (this._mpris !== undefined)
            this._mpris = Components.release('mpris');

        super.destroy();
    }
});

export default TelephonyPlugin;
