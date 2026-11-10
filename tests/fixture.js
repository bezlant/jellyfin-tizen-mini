/* Synthetic network/player adapters. Never shipped in the TV widget. */
(function () {
    const qa = window.miniQA = { calls: [], requests: [], seeking: false, time: 0, invalidCalls: [] };
    const item = {
        Id: 'test-film', Name: 'Test Film', RunTimeTicks: 12000000000,
        UserData: { PlaybackPositionTicks: 600000000 },
        MediaSources: [{ Id: 'test-source', MediaStreams: [
            { Type: 'Subtitle', Index: 1, Language: 'eng', Codec: 'subrip', IsExternal: true }
        ] }]
    };
    const storage = {};
    Object.defineProperty(window, 'localStorage', { value: {
        length: 0, getItem: key => storage[key] || null,
        setItem: (key, value) => { storage[key] = String(value); }
    } });
    window.XMLHttpRequest = function () { this.headers = {}; };
    window.XMLHttpRequest.prototype.open = function (method, url) {
        this.method = method; this.path = new URL(url).pathname + new URL(url).search;
    };
    window.XMLHttpRequest.prototype.setRequestHeader = function (key, value) { this.headers[key] = value; };
    window.XMLHttpRequest.prototype.abort = function () { clearTimeout(this.timer); };
    window.XMLHttpRequest.prototype.send = function (body) {
        const path = this.path;
        qa.requests.push({ path, body: body ? JSON.parse(body) : null });
        let result;
        if (!/^MediaBrowser Client=/.test(this.headers.Authorization || '')) {
            throw Error('Missing MediaBrowser Authorization header');
        }
        if (path === '/Users/AuthenticateByName') { result = { AccessToken: 'synthetic-test-token', User: { Id: 'test-user' } }; }
        else if (path.startsWith('/Items?')) { result = { Items: [item] }; }
        else if (path.startsWith('/Items/test-film?')) { result = item; }
        else if (path === '/Items/test-film/PlaybackInfo') {
            result = { PlaySessionId: 'test-session', MediaSources: [
                { Id: 'test-source', TranscodingUrl: '/test-stream.m3u8', DefaultAudioStreamIndex: 0 }
            ] };
        } else if (path.includes('/Subtitles/')) {
            result = '1\n00:01:10,000 --> 00:01:12,000\nCaption after seeking.';
        } else if (path.startsWith('/Sessions/Playing')) { result = null; }
        else { throw Error('Unexpected fixture request: ' + path); }
        this.timer = setTimeout(() => {
            this.status = 200;
            this.responseText = typeof result === 'string' ? result : JSON.stringify(result);
            this.onload();
        }, 10);
    };
    function call(name) {
        if (qa.seeking) { qa.invalidCalls.push(name); throw Error('Player call during pending seek: ' + name); }
        qa.calls.push(name);
    }
    window.webapis = { avplay: {
        open: () => call('open'),
        setListener: listener => { call('listener'); qa.listener = listener; },
        setDisplayRect: () => call('display'),
        prepareAsync: done => { call('prepare'); setTimeout(done, 10); },
        getDuration: () => { call('duration'); return 1200000; },
        play: () => { call('play'); qa.listener.oncurrentplaytime(qa.time); },
        pause: () => call('pause'), stop: () => call('stop'), close: () => call('close'),
        seekTo: (time, done) => {
            call('seek:' + time); qa.seeking = true;
            setTimeout(() => {
                qa.seeking = false; qa.time = time;
                // The J6200 can finish a paused seek without a play-time event.
                done();
            }, 100);
        }
    } };
}());
