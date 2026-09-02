/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * VoiceFix: Discord web ignores Voice & Video toggles and always sends
 * echoCancellation/noiseSuppression/autoGainControl + advanced:[{autoGainControl}]
 * Force-off regardless of MediaEngineStore - web equivalent of WEBRTC VoiceEngine.
 */

import { Logger } from "@vencord/types/utils";

const logger = new Logger("VesktopVoiceFix");

function fixAudioTrackConstraints(constraint: MediaTrackConstraints) {
    (constraint as any).echoCancellation = false;
    (constraint as any).noiseSuppression = false;
    (constraint as any).autoGainControl = false;
    delete (constraint as any).googEchoCancellation;
    delete (constraint as any).googEchoCancellation2;
    delete (constraint as any).googNoiseSuppression;
    delete (constraint as any).googNoiseSuppression2;
    delete (constraint as any).googAutoGainControl;
    delete (constraint as any).googAutoGainControl2;
    delete (constraint as any).googHighpassFilter;
    if ((constraint as any).advanced) {
        const adv = (constraint as any).advanced as any[];
        const filtered = adv.filter(
            (o: any) =>
                !("autoGainControl" in o) &&
                !("echoCancellation" in o) &&
                !("noiseSuppression" in o) &&
                !("googAutoGainControl" in o) &&
                !("googEchoCancellation" in o) &&
                !("googNoiseSuppression" in o)
        );
        if (filtered.length === 0) delete (constraint as any).advanced;
        else (constraint as any).advanced = filtered;
    }
}

function fixVideoTrackConstraints(constraint: MediaTrackConstraints) {
    if (typeof constraint.deviceId === "string" && constraint.deviceId !== "default") {
        constraint.deviceId = { exact: constraint.deviceId };
    }
}

function fixStreamConstraints(constraints: MediaStreamConstraints | undefined) {
    if (!constraints) return;
    if (constraints.audio) {
        if (typeof constraints.audio !== "object") constraints.audio = {};
        if ((constraints as any).audio === true) (constraints as any).audio = {};
        fixAudioTrackConstraints(constraints.audio as MediaTrackConstraints);
    }
    if (constraints.video) {
        if (typeof constraints.video !== "object") constraints.video = {};
        fixVideoTrackConstraints(constraints.video as MediaTrackConstraints);
    }
}

const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
navigator.mediaDevices.getUserMedia = function (constraints) {
    try {
        fixStreamConstraints(constraints as any);
    } catch (e) {
        logger.error("Failed to fix getUserMedia constraints", e);
    }
    return originalGetUserMedia.call(this, constraints as any);
};

const originalApplyConstraints = MediaStreamTrack.prototype.applyConstraints;
MediaStreamTrack.prototype.applyConstraints = function (constraints) {
    if (constraints) {
        try {
            if (this.kind === "audio") fixAudioTrackConstraints(constraints as MediaTrackConstraints);
            else if (this.kind === "video") fixVideoTrackConstraints(constraints as MediaTrackConstraints);
        } catch (e) {
            logger.error("Failed to fix constraints", e);
        }
    }
    return originalApplyConstraints.call(this, constraints as any);
};
