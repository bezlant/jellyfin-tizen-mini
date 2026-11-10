(async function () {
    const result = document.getElementById('result');
    const frame = document.getElementById('app');
    const assert = (value, message) => { if (!value) { throw Error(message); } };
    const until = async (condition, message) => {
        const deadline = Date.now() + 2000;
        while (!condition()) {
            assert(Date.now() < deadline, message);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    };
    try {
        // Exercise the shipped HTML and JS; only the hardware/network seams vary.
        const response = await fetch('../index.html');
        assert(response.ok, 'Cannot load the app HTML');
        const source = await response.text();
        const loaded = new Promise(resolve => { frame.onload = resolve; });
        frame.srcdoc = source.replace('<head>', '<head><base href="../">')
            .replace('<script src="$WEBAPIS/webapis/webapis.js"></script>', '<script src="tests/fixture.js"></script>');
        await loaded;
        const win = frame.contentWindow, doc = win.document, qa = win.miniQA;
        const el = id => doc.getElementById(id);
        const key = keyCode => doc.dispatchEvent(new win.KeyboardEvent('keydown', { keyCode, bubbles: true }));
        assert(qa, 'Synthetic adapters did not load');
        el('server').value = 'http://jellyfin.example';
        el('username').value = 'test-user'; el('password').value = 'test-only';
        el('login-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
        await until(() => doc.querySelector('.movie'), 'Login did not open the library');
        assert(el('password').value === '', 'Password was not cleared');
        doc.querySelector('.movie').click();
        await until(() => !el('play').disabled, 'Details did not become playable');
        el('play').click();
        await until(() => qa.calls.includes('play'), 'Bookmark resume did not start');
        assert(qa.calls.includes('seek:60000'), 'Resume skipped the saved bookmark');
        key(13);

        for (const [direction, time] of [[39, 70000], [39, 80000], [37, 70000]]) {
            key(direction);
            await until(() => !qa.seeking, 'Paused seek did not finish');
            const reports = qa.requests.filter(r => r.path === '/Sessions/Playing/Progress');
            assert(reports[reports.length - 1].body.PositionTicks === time * 10000,
                'Paused seek reported a stale position');
            assert(qa.time === time && el('player-time').textContent === (time === 80000 ? '1:20' : '1:10'),
                'Paused seek did not update the time or accumulate');
            assert(el('subtitle-cue').textContent === (time === 80000 ? '' : 'Caption after seeking.'),
                'Paused seek left stale captions');
        }

        key(13);
        key(39); key(13); key(39);
        await until(() => !qa.seeking, 'Seek serialization did not finish');
        assert(el('pause-label').textContent === 'Pause', 'Pending seek changed pause state');
        key(13); key(13);
        assert(qa.calls.slice(-2).join(',') === 'pause,play', 'Pause/resume failed after seeking');

        key(39); key(27);
        assert(!doc.body.classList.contains('playing'), 'Return did not restore details');
        el('restart').click();
        await until(() => !qa.seeking, 'Return during seek did not settle');
        assert(qa.calls.slice(-2).join(',') === 'stop,close', 'Return did not release the player after seek');
        qa.calls.length = 0;
        el('play').click();
        await until(() => qa.calls.includes('play'), 'Replay did not start');
        assert(qa.calls.includes('seek:80000'), 'Return lost the current bookmark');
        assert(qa.invalidCalls.length === 0, 'Calls during pending seek: ' + qa.invalidCalls.join(', '));
        key(27);
        result.dataset.status = 'pass';
        result.textContent = 'PASS: login, resume, paused seeks/captions/progress, seek serialization, Return and replay.';
    } catch (error) {
        result.dataset.status = 'fail'; result.textContent = 'FAIL: ' + error.message;
    }
}());
