(function (root) {
    'use strict';
    function parseSrt(text) {
        var cues = [], blocks = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/);
        function ms(h, m, s, f) { return (+h * 3600 + +m * 60 + +s) * 1000 + +(f + '00').slice(0, 3); }
        blocks.forEach(function (block) {
            var lines = block.split('\n'), i, match;
            for (i = 0; i < lines.length; i += 1) {
                match = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/.exec(lines[i]);
                if (match) {
                    cues.push({ start: ms(match[1], match[2], match[3], match[4]), end: ms(match[5], match[6], match[7], match[8]),
                        text: lines.slice(i + 1).join('\n').replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '') });
                    break;
                }
            }
        });
        return cues.sort(function (a, b) { return a.start - b.start; });
    }
    function cueText(cues, time) {
        var visible = [], i;
        for (i = 0; i < cues.length && cues[i].start <= time; i += 1) {
            if (time < cues[i].end) { visible.push(cues[i].text); }
        }
        return visible.join('\n');
    }
    function isBitmap(stream) { return /^(pgssub|dvdsub|dvbsub|hdmv_pgs_subtitle)$/i.test(stream.Codec || ''); }
    function englishTrack(streams) {
        var best = null, bestScore = Infinity;
        streams.forEach(function (s) {
            if (s.Type !== 'Subtitle' || !/^(eng|en)$/i.test(s.Language || '')) { return; }
            // Some library files mark forced/SDH only in their title, not the flags.
            var forced = s.IsForced || /\bforced\b/i.test(s.Title || '');
            var sdh = s.IsHearingImpaired || /\bSDH\b/i.test(s.Title || '');
            var score = (forced ? 16 : 0) + (sdh ? 8 : 0) + (isBitmap(s) ? 4 : 0) + (s.IsExternal ? 0 : 1);
            if (score < bestScore) { best = s; bestScore = score; }
        });
        return best;
    }
    function profile() {
        return {
            Name: 'J6200 Mini Player', MaxStreamingBitrate: 20000000,
            DirectPlayProfiles: [], ContainerProfiles: [],
            TranscodingProfiles: [{ Container: 'ts', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac',
                Protocol: 'hls', Context: 'Streaming', MaxAudioChannels: '2', MinSegments: 1,
                SegmentLength: 3, BreakOnNonKeyFrames: false, EnableSubtitlesInManifest: false }],
            CodecProfiles: [{ Type: 'Video', Codec: 'h264', Conditions: [
                { Condition: 'LessThanEqual', Property: 'VideoBitDepth', Value: '8', IsRequired: true },
                { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '41', IsRequired: true },
                { Condition: 'LessThanEqual', Property: 'Width', Value: '1920', IsRequired: true },
                { Condition: 'LessThanEqual', Property: 'Height', Value: '1080', IsRequired: true }
            ] }],
            SubtitleProfiles: [{ Format: 'srt', Method: 'External' }, { Format: 'pgssub', Method: 'Encode' },
                { Format: 'dvdsub', Method: 'Encode' }, { Format: 'dvbsub', Method: 'Encode' }]
        };
    }
    var api = { parseSrt: parseSrt, cueText: cueText, isBitmap: isBitmap, englishTrack: englishTrack, profile: profile };
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; } else { root.MiniCore = api; }
}(this));
