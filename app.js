(function () {
    'use strict';
    var core = window.MiniCore, PAGE_SIZE = 12, page = 0, libraryIndex = 0, movies = [], selected = null, source = null;
    var server = '', token = '', userId = '', screen = 'login', subtitle = null, subtitleOptions = [];
    var av = window.webapis && window.webapis.avplay, playing = false, prepared = false, paused = false, seeking = false;
    var session = null, cues = [], position = 0, progressTimer = null, controlsTimer = null, playerRequests = [];
    function el(id) { return document.getElementById(id); }
    function text(id, value) { el(id).textContent = value; }
    function notice(value) { text('notice', value || ''); }
    function tokenKey() { return 'home-cinema-token:' + server; }
    function show(name) {
        screen = name;
        ['login', 'library', 'detail'].forEach(function (id) { el(id).className = 'screen' + (id === name ? '' : ' hidden'); });
        showBackdrop(name === 'detail' ? selected : null);
        notice('');
    }
    function focus(id) { if (el(id) && !el(id).disabled) { el(id).focus(); } }
    function url(path) { return /^https?:\/\//i.test(path) ? path : server + (path.charAt(0) === '/' ? '' : '/') + path; }
    function query(values) {
        return Object.keys(values).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(values[key]); }).join('&');
    }
    function request(method, path, body, done, plain) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url(path), true);
        xhr.timeout = 65000;
        xhr.setRequestHeader('Authorization', 'MediaBrowser Client="Luma", Device="Samsung J6200", DeviceId="home-cinema-j6200", Version="0.1.0"' + (token ? ', Token="' + token + '"' : ''));
        if (body !== null) { xhr.setRequestHeader('Content-Type', 'application/json'); }
        xhr.onload = function () {
            if (xhr.status < 200 || xhr.status >= 300) { done(new Error(xhr.status === 401 ? 'Sign in again to continue.' : 'Jellyfin returned HTTP ' + xhr.status + '.')); return; }
            if (plain) { done(null, xhr.responseText); return; }
            try { done(null, xhr.responseText ? JSON.parse(xhr.responseText) : null); }
            catch (error) { done(new Error('Jellyfin returned an unreadable response.')); }
        };
        xhr.onerror = function () { done(new Error('Cannot reach Jellyfin. Check the server address and network.')); };
        xhr.ontimeout = function () { done(new Error('Jellyfin took too long to respond. Try again.')); };
        xhr.send(body === null ? null : JSON.stringify(body));
        return xhr;
    }
    function poster(item, width) {
        if (!item.ImageTags || !item.ImageTags.Primary) { return ''; }
        return url('/Items/' + item.Id + '/Images/Primary?' + query({ fillWidth: width, quality: 80, tag: item.ImageTags.Primary, api_key: token }));
    }
    function image(node, src) {
        if (src) { node.src = src; node.style.visibility = 'visible'; }
        else { node.removeAttribute('src'); node.style.visibility = 'hidden'; }
        node.onerror = function () { node.style.visibility = 'hidden'; };
    }
    function showBackdrop(item) {
        var tag = item && item.BackdropImageTags && item.BackdropImageTags[0];
        el('detail-backdrop').style.backgroundImage = tag ? 'url("' + url('/Items/' + item.Id + '/Images/Backdrop/0?' + query({ maxWidth: 960, maxHeight: 540, quality: 80, format: 'Jpg', tag: tag, api_key: token })) + '")' : 'none';
    }
    function playActions() {
        var resume = selected && selected.UserData && selected.UserData.PlaybackPositionTicks > 0;
        text('play-label', resume ? 'Resume' : 'Play');
        el('restart').className = resume ? '' : 'hidden';
    }
    function focusLibrary() {
        var card = el('movie-grid').children[libraryIndex - page * PAGE_SIZE];
        if (card) { card.focus(); } else { focus('movie-grid'); }
    }
    function renderLibrary() {
        var grid = el('movie-grid'), start = page * PAGE_SIZE;
        show('library');
        grid.textContent = '';
        movies.slice(start, start + PAGE_SIZE).forEach(function (item, index) {
            var button = document.createElement('button'), art = document.createElement('span'), img = document.createElement('img');
            var info = document.createElement('span'), name = document.createElement('span'), year = document.createElement('span');
            button.className = 'movie'; button.type = 'button'; button.setAttribute('aria-label', item.Name);
            img.alt = ''; image(img, poster(item, 200));
            art.className = 'movie-art'; art.appendChild(img);
            name.className = 'movie-name'; name.textContent = item.Name;
            year.className = 'movie-year'; year.textContent = item.ProductionYear || '';
            info.className = 'movie-info'; info.appendChild(name); info.appendChild(year);
            button.appendChild(art); button.appendChild(info);
            button.onfocus = function () { libraryIndex = start + index; };
            button.onclick = function () { openMovie(item); };
            grid.appendChild(button);
        });
        text('page-label', movies.length ? (start + 1) + '–' + Math.min(start + PAGE_SIZE, movies.length) + ' of ' + movies.length : 'No movies');
        if (!movies.length) { notice('No movies in this library yet. Add movies in Jellyfin, then reopen Luma.'); }
        focusLibrary();
    }
    function loadLibrary() {
        show('library'); notice('Loading your movies…');
        request('GET', '/Items?' + query({ userId: userId, includeItemTypes: 'Movie', recursive: true, sortBy: 'SortName', sortOrder: 'Ascending', fields: 'Overview', enableUserData: true, imageTypeLimit: 1, enableImageTypes: 'Primary' }), null, function (error, data) {
            if (error) { notice(error.message); return; }
            movies = data.Items || []; page = 0; libraryIndex = 0; renderLibrary();
        });
    }
    function connect(event) {
        event.preventDefault();
        server = el('server').value.replace(/\/+$/, '').trim();
        if (!/^https?:\/\/[^\s/@]+(?::\d+)?(?:\/[^\s]*)?$/i.test(server)) { notice('Enter a server address starting with http:// or https://.'); focus('server'); return; }
        el('connect').disabled = true; notice('Connecting…'); token = '';
        request('POST', '/Users/AuthenticateByName', { Username: el('username').value, Pw: el('password').value }, function (error, data) {
            el('connect').disabled = false; el('password').value = '';
            if (error) { notice(error.message); focus('password'); return; }
            token = data.AccessToken; userId = data.User.Id;
            try {
                localStorage.setItem(tokenKey(), token);
                localStorage.setItem('home-cinema-server', server);
            } catch (ignored) { /* Playback still works when storage is unavailable. */ }
            loadLibrary();
        });
    }
    function subtitleLabel(track) {
        if (!track) { return 'Off'; }
        var label = track.Title || track.DisplayTitle || track.Language || 'Subtitle ' + track.Index;
        if (/^(eng|en)$/i.test(track.Language || '') && !/^English\b/i.test(label)) {
            label = track.DisplayTitle || label;
            if (label.indexOf('English') !== -1) { label = label.slice(label.indexOf('English')); }
        }
        if (track.Codec) { label = label.replace(' - ' + track.Codec.toUpperCase(), ''); }
        return label.replace(' - External', '').replace(' - Default', '')
            .replace(' - Hearing Impaired', ' (SDH)').replace(' - Forced', ' (Forced)');
    }
    function movieCopy(item) {
        var minutes = Math.round((item.RunTimeTicks || 0) / 600000000);
        var runtime = minutes ? (minutes >= 60 ? Math.floor(minutes / 60) + 'h ' : '') + minutes % 60 + 'm' : '';
        text('movie-title', item.Name);
        text('movie-meta', [item.ProductionYear, runtime, item.OfficialRating].filter(Boolean).join(' · '));
        text('movie-genres', (item.Genres || []).join(' · '));
        text('movie-overview', item.Overview || '');
        el('movie-overview').tabIndex = el('movie-overview').scrollHeight > el('movie-overview').clientHeight ? 0 : -1;
    }
    function openMovie(item) {
        selected = item; source = null; show('detail');
        movieCopy(item);
        el('movie-overview').scrollTop = 0;
        el('play').disabled = true; el('restart').disabled = true; playActions();
        text('subtitles', 'Loading subtitles…'); el('subtitles').disabled = true; notice('Loading movie details…');
        focus('detail');
        request('GET', '/Items/' + item.Id + '?' + query({ userId: userId }), null, function (error, data) {
            if (screen !== 'detail' || selected.Id !== item.Id) { return; }
            if (error) { notice(error.message); return; }
            selected = data; source = data.MediaSources && data.MediaSources[0];
            showBackdrop(data);
            movieCopy(data);
            if (!source) { notice('Jellyfin did not provide a playable source for this movie.'); return; }
            subtitleOptions = [null].concat((source.MediaStreams || []).filter(function (s) { return s.Type === 'Subtitle'; }));
            subtitle = core.englishTrack(source.MediaStreams || []);
            text('subtitles', 'Subtitles: ' + subtitleLabel(subtitle)); el('subtitles').disabled = subtitleOptions.length === 1;
            el('play').disabled = false; el('restart').disabled = false;
            playActions();
            notice(''); focus('play');
        });
    }
    function report(kind, failed) {
        if (!session) { return; }
        var payload = { ItemId: selected.Id, MediaSourceId: session.source.Id, PlaySessionId: session.id, PositionTicks: Math.round(position * 10000) };
        if (kind === 'Stopped') { payload.Failed = !!failed; }
        else {
            payload.CanSeek = true; payload.PlayMethod = 'Transcode'; payload.IsPaused = paused;
            payload.SubtitleStreamIndex = subtitle ? subtitle.Index : -1;
            payload.AudioStreamIndex = session.source.DefaultAudioStreamIndex;
        }
        request('POST', '/Sessions/Playing' + (kind ? '/' + kind : ''), payload, function (error) {
            if (error && playing) { text('player-status', 'Movie is playing, but Jellyfin could not save progress.'); }
        });
    }
    var duration = 0;
    function clock(ms) {
        var s = Math.floor(Math.max(0, ms) / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
        return (h ? h + ':' + ('0' + m).slice(-2) : String(m)) + ':' + ('0' + s % 60).slice(-2);
    }
    function updatePlaybackPosition(ms) {
        position = Number(ms);
        text('subtitle-cue', core.cueText(cues, position));
        text('player-time', clock(position));
        text('player-duration', duration ? clock(duration) : '');
        el('player-total').className = duration ? '' : 'hidden';
        var minutes = Math.ceil(Math.max(0, duration - position) / 60000);
        text('player-remaining', duration ? (minutes >= 60 ? Math.floor(minutes / 60) + 'h ' : '') + minutes % 60 + 'm left' : '');
        var percent = duration ? Math.max(0, Math.min(100, 100 * position / duration)) : 0;
        el('player-progress-fill').style.width = percent + '%';
        el('player-progress').setAttribute('aria-valuenow', Math.round(percent));
        el('player-progress').setAttribute('aria-valuetext', clock(position) + (duration ? ' of ' + clock(duration) : ''));
    }
    function pauseControl() {
        text('pause-label', paused ? 'Play' : 'Pause');
        el('pause').className = paused ? 'is-paused' : '';
    }
    function controls() {
        var subtitlesClass = subtitle && core.isBitmap(subtitle) ? 'bitmap-subtitles' : '';
        el('playback').className = 'controls-visible ' + subtitlesClass;
        if (prepared) { focus('pause'); }
        clearTimeout(controlsTimer);
        if (!paused && prepared) { controlsTimer = setTimeout(function () { el('playback').className = subtitlesClass; }, 3500); }
    }
    function closePlayer() {
        try { av.stop(); } catch (ignoredStop) { /* close also releases an incompletely prepared player. */ }
        try { av.close(); } catch (ignoredClose) { /* Restore the UI even when the device player already closed. */ }
    }
    function seekPlayer(time, done, failed) {
        seeking = true;
        function finish(callback) {
            seeking = false;
            if (!playing) { closePlayer(); return; }
            callback();
        }
        // AVPlay forbids other player calls until the asynchronous seek callback.
        try { av.seekTo(time, function () { finish(function () { updatePlaybackPosition(time); done(); }); }, function () { finish(failed); }); }
        catch (error) { finish(failed); }
    }
    function stopPlayback(failed, completed) {
        playerRequests.forEach(function (xhr) { xhr.abort(); }); playerRequests = [];
        clearInterval(progressTimer); clearTimeout(controlsTimer);
        if (session) { report('Stopped', failed); }
        if (av && playing && !seeking) { closePlayer(); }
        if (completed) { position = 0; }
        if (selected && selected.UserData && session) { selected.UserData.PlaybackPositionTicks = Math.round(position * 10000); }
        playing = false; prepared = false; session = null; cues = []; paused = false;
        document.body.className = ''; el('playback').className = 'hidden'; text('subtitle-cue', '');
        pauseControl(); if (selected) { show('detail'); playActions(); focus('play'); }
    }
    function playbackError(message) { stopPlayback(true); notice(message); }
    function startPlayback(fromStart) {
        if (!av) { notice('Playback needs the Samsung TV. This browser can preview the interface only.'); return; }
        if (!source || playing || seeking) { return; }
        var resume = fromStart ? 0 : Math.floor((selected.UserData && selected.UserData.PlaybackPositionTicks || 0) / 10000);
        var bitmap = subtitle && core.isBitmap(subtitle);
        playing = true; prepared = false; position = resume; cues = [];
        duration = Math.floor((selected.RunTimeTicks || 0) / 10000);
        el('pause').disabled = true; pauseControl(); updatePlaybackPosition(position);
        showBackdrop(null);
        document.body.className = 'playing'; el('playback').className = '';
        text('player-title', selected.Name); text('player-status', 'Preparing your movie…'); text('subtitle-cue', ''); controls();
        playerRequests.push(request('POST', '/Items/' + selected.Id + '/PlaybackInfo', {
            UserId: userId, MediaSourceId: source.Id, DeviceProfile: core.profile(), MaxStreamingBitrate: 20000000,
            StartTimeTicks: 0, EnableDirectPlay: false, EnableDirectStream: false, EnableTranscoding: true,
            AllowVideoStreamCopy: false, AllowAudioStreamCopy: false, MaxAudioChannels: 2,
            SubtitleStreamIndex: bitmap ? subtitle.Index : -1, AlwaysBurnInSubtitleWhenTranscoding: !!bitmap
        }, function (error, data) {
            if (!playing) { return; }
            if (error) { playbackError(error.message); return; }
            var media = data.MediaSources && data.MediaSources[0];
            if (!media || !media.TranscodingUrl) { playbackError('Jellyfin could not prepare an H.264 stream for this TV.'); return; }
            session = { id: data.PlaySessionId, source: media };
            function prepare() {
                if (!playing) { return; }
                try {
                    av.open(url(media.TranscodingUrl));
                    av.setListener({
                        onbufferingstart: function () { text('player-status', 'Buffering…'); },
                        onbufferingcomplete: function () { text('player-status', ''); },
                        oncurrentplaytime: updatePlaybackPosition,
                        onstreamcompleted: function () { stopPlayback(false, true); },
                        onerror: function (code) { playbackError('The TV could not play this stream (' + String(code).replace(/[^A-Z0-9_]/gi, '').slice(0, 60) + '). Try Play from start.'); }
                    });
                    av.setDisplayRect(0, 0, 1920, 1080);
                    av.prepareAsync(function () {
                        if (!playing) { return; }
                        duration = av.getDuration(); updatePlaybackPosition(position);
                        function begin() {
                            if (!playing) { return; }
                            try {
                                av.play(); prepared = true; el('pause').disabled = false; report(''); text('player-status', '');
                                progressTimer = setInterval(function () { report('Progress'); }, 10000); controls();
                            } catch (error) { playbackError('The TV prepared the movie but could not start playback.'); }
                        }
                        if (resume > 0) { seekPlayer(resume, begin, function () { playbackError('The TV could not resume here. Choose Play from start.'); }); }
                        else { begin(); }
                    }, function () { playbackError('The TV could not prepare this movie. Try again.'); });
                } catch (error) { playbackError('The TV player could not open this movie.'); }
            }
            if (subtitle && !bitmap) {
                text('player-status', 'Loading subtitles…');
                playerRequests.push(request('GET', '/Videos/' + selected.Id + '/' + media.Id + '/Subtitles/' + subtitle.Index + '/0/Stream.srt', null, function (subError, raw) {
                    if (!playing) { return; }
                    if (subError) { playbackError('Subtitles could not load. Try again, or choose Subtitles: Off.'); return; }
                    cues = core.parseSrt(raw);
                    if (!cues.length) { playbackError('This subtitle track did not contain readable text. Choose another track.'); return; }
                    prepare();
                }, true));
            } else { prepare(); }
        }));
    }
    function togglePause() {
        if (!prepared || seeking) { return; }
        try { if (paused) { av.play(); } else { av.pause(); } paused = !paused; pauseControl(); report('Progress'); controls(); }
        catch (error) { text('player-status', 'The TV could not change playback state. Press Return to stop.'); }
    }
    function seek(delta) {
        if (!prepared || seeking) { return; }
        try { seekPlayer(Math.max(0, Math.min(position + delta, av.getDuration() - 1000)), function () { report('Progress'); }, function () { text('player-status', 'The TV could not seek here.'); }); controls(); }
        catch (error) { text('player-status', 'Seeking is unavailable for this stream.'); }
    }
    function moveFocus(code) {
        var active = document.activeElement, rect = active.getBoundingClientRect(), best = null, score = Infinity;
        if (screen === 'library') {
            if (active.className === 'movie') {
                var columns = window.innerWidth <= 600 ? 2 : window.innerWidth <= 1000 ? 3 : 6;
                if (code === 38 && libraryIndex < columns) { return; }
                if (code === 40 && Math.floor(libraryIndex / columns) === Math.floor((movies.length - 1) / columns)) { return; }
                var step = code === 37 ? -1 : code === 39 ? 1 : code === 38 ? -columns : columns;
                libraryIndex = Math.max(0, Math.min(movies.length - 1, libraryIndex + step));
                var nextPage = Math.floor(libraryIndex / PAGE_SIZE);
                if (nextPage !== page) { page = nextPage; renderLibrary(); }
                else { focusLibrary(); }
                return;
            }
        }
        var horizontal = code === 37 || code === 39, positive = code === 39 || code === 40;
        Array.prototype.forEach.call(document.querySelectorAll('button,input,[tabindex="0"]'), function (candidate) {
            if (candidate === active || candidate.disabled || !candidate.offsetWidth || !candidate.offsetHeight) { return; }
            if (screen === 'detail' && horizontal && candidate.id === 'movie-overview') { return; }
            var box = candidate.getBoundingClientRect();
            var dx = (box.left + box.right - rect.left - rect.right) / 2, dy = (box.top + box.bottom - rect.top - rect.bottom) / 2;
            var primary = horizontal ? dx : dy, secondary = horizontal ? dy : dx;
            if ((positive && primary <= 1) || (!positive && primary >= -1)) { return; }
            var value = Math.abs(primary) + Math.abs(secondary) * 3;
            if (value < score) { score = value; best = candidate; }
        });
        if (best) { best.focus(); }
    }
    document.addEventListener('keydown', function (event) {
        var code = event.keyCode, input = document.activeElement.tagName === 'INPUT';
        if (code === 10009 || code === 27) {
            event.preventDefault();
            if (playing) { stopPlayback(false); }
            else if (screen === 'detail') { renderLibrary(); }
            else if (screen === 'library') { focusLibrary(); }
            else { focus('username'); }
        } else if (playing) {
            if (code === 13 || code === 10252) { event.preventDefault(); togglePause(); }
            else if (code === 415) { event.preventDefault(); if (paused) { togglePause(); } }
            else if (code === 19) { event.preventDefault(); if (!paused) { togglePause(); } }
            else if (code === 37 || code === 39) { event.preventDefault(); seek(code === 37 ? -10000 : 10000); }
            else if (code === 413) { event.preventDefault(); stopPlayback(false); }
            else { controls(); }
        } else if (code >= 37 && code <= 40 && !(input && (code === 37 || code === 39))) {
            var overview = el('movie-overview');
            if (document.activeElement === overview && ((code === 38 && overview.scrollTop > 0) || (code === 40 && overview.scrollTop + overview.clientHeight < overview.scrollHeight))) {
                event.preventDefault(); overview.scrollTop += code === 38 ? -80 : 80; return;
            }
            if (document.activeElement === overview) {
                event.preventDefault(); if (code === 40) { focus('play'); } return;
            }
            event.preventDefault(); moveFocus(code);
        } else if (code === 13 && document.activeElement.tagName === 'BUTTON') {
            event.preventDefault(); document.activeElement.click();
        }
    });
    el('login-form').onsubmit = connect;
    el('play').onclick = function () { startPlayback(false); };
    el('restart').onclick = function () { startPlayback(true); };
    el('subtitles').onclick = function () { subtitle = subtitleOptions[(subtitleOptions.indexOf(subtitle) + 1) % subtitleOptions.length]; text('subtitles', 'Subtitles: ' + subtitleLabel(subtitle)); };
    el('pause').onclick = togglePause;
    document.addEventListener('visibilitychange', function () { if (document.hidden && playing) { stopPlayback(false); } });
    window.addEventListener('beforeunload', function () { if (playing) { stopPlayback(false); } });
    if (window.tizen && window.tizen.tvinputdevice) {
        ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop'].forEach(function (key) { try { window.tizen.tvinputdevice.registerKey(key); } catch (ignored) {} });
    }
    server = el('server').value;
    try {
        server = localStorage.getItem('home-cinema-server') || server;
        if (!server) {
            // Earlier installs saved only a token keyed by their server URL.
            var savedServers = [], storageIndex, storageKey, prefix = 'home-cinema-token:';
            for (storageIndex = 0; storageIndex < localStorage.length; storageIndex += 1) {
                storageKey = localStorage.key(storageIndex);
                if (storageKey.indexOf(prefix) === 0) { savedServers.push(storageKey.slice(prefix.length)); }
            }
            if (savedServers.length === 1) { server = savedServers[0]; }
        }
        token = server ? localStorage.getItem(tokenKey()) || '' : '';
    } catch (ignoredStorage) {}
    el('server').value = server;
    if (token) {
        notice('Opening your library…');
        request('GET', '/Users/Me', null, function (error, user) {
            if (error) { token = ''; notice(error.message); focus('username'); return; }
            try { localStorage.setItem('home-cinema-server', server); } catch (ignoredStorage) {}
            userId = user.Id; loadLibrary();
        });
    } else { focus(server ? 'username' : 'server'); }
}());
