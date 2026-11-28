    // Fixed silhouettes, shared by the profile shelf, game rows and trophy details.
    function _trophySvg(tier) {
        const platinum = '<path fill="#244794" d="m3 11 12 6L24 3l9 14 12-6-5 21-12 5v3l7 2v3H13v-3l7-2v-3L8 32Z"/><path fill="#528cfa" d="m3 11 12 6 9-14 9 14 12-6-9 15-12 9-12-9Z"/><path fill="#3568ca" d="m3 11 12 6 9 18-12-9Z"/><path fill="#87b7ff" d="m24 3 9 14-9 18Z"/><path fill="#a8d2ff" d="m24 3-7 17-2-3Z M45 11l-9 15-7 4Z"/><path fill="#759bc9" d="m8 32 16 4 16-4-12 5h-8Z"/><path fill="#46668d" d="m20 40 4-2 4 2 7 2H13Z"/><path fill="#a3c2e6" d="M13 42h22v1H13Z"/>';
        const cups = {
            cup:'<path d="M12 8h24v4h7v4c0 7-5 12-12 13a12 12 0 0 1-5 3v7h8v4H14v-4h8v-7a12 12 0 0 1-5-3C10 28 5 23 5 16v-4h7zm0 8H9c0 4 2 7 6 8a21 21 0 0 1-3-8zm24 0a21 21 0 0 1-3 8c4-1 6-4 6-8z"/>',
            iron:'<path d="M12 8h24l-3 13q-2 7-7 9v7l6 3v3H16v-3l6-3v-7q-5-2-7-9Z"/><path fill="#b6c0c6" d="M12 8h24l-1 3H13Z"/>',
            bronze:'<path fill="none" stroke="currentColor" stroke-width="3" d="M12 12H5q0 11 12 12m19-12h7q0 11-12 12"/><path d="M10 7h28l-2 12q-2 9-10 12v5l7 4v3H15v-3l7-4v-5q-8-3-10-12Z"/><path fill="#e8b18b" d="M10 7h28l-1 3H11Z"/>',
            silver:'<path fill="none" stroke="currentColor" stroke-width="3" d="M13 11Q2 6 5 17q2 6 12 7m18-13q11-5 8 6-2 6-12 7"/><path d="M12 5h24q-1 18-10 23v7l5 3 3 1v4H14v-4l3-1 5-3v-7Q13 23 12 5Z"/><path fill="#f0f5fc" d="M14 7h5q0 9 3 16-6-5-8-16Z"/><path fill="#8392a6" d="M14 40h20v3H14Z"/>',
            gold:'<path fill="none" stroke="currentColor" stroke-width="3.5" d="M10 11C-1 7 3 24 16 24m22-13c11-4 7 13-6 13"/><path d="M9 6h30l-2 12q-2 9-11 12v4l6 3v2h4v5H12v-5h4v-2l6-3v-4q-9-3-11-12Z"/><path fill="#ffe5a0" d="M9 6h30l-1 3H10Zm4 5h5q0 8 4 14-7-3-9-14Z"/><path fill="#a8762f" d="M12 41h24v3H12Z"/>'
        };
        const shape = tier==='platinum'?platinum:cups[tier] || cups.iron;
        return '<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">'+shape+'</svg>';
    }
    window.doorpiTrophyIcon = _trophySvg;
