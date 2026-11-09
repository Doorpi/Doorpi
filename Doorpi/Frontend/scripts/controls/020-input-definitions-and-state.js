    const PAD_LABELS = {
        a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT',
        back: 'View', guide: 'Xbox', start: 'Menu', l3: 'L3', r3: 'R3',
        'dpad-up': 'D-Pad ↑', 'dpad-down': 'D-Pad ↓', 'dpad-left': 'D-Pad ←', 'dpad-right': 'D-Pad →',
        'left-stick': 'Analógico L', 'right-stick': 'Analógico R',
        'left-stick-up': 'Analógico L ↑', 'left-stick-down': 'Analógico L ↓',
        'left-stick-left': 'Analógico L ←', 'left-stick-right': 'Analógico L →',
        'right-stick-up': 'Analógico R ↑', 'right-stick-down': 'Analógico R ↓',
        'right-stick-left': 'Analógico R ←', 'right-stick-right': 'Analógico R →'
    };

    const KEY_ROWS = [
        [[27,'Esc'],[112,'F1'],[113,'F2'],[114,'F3'],[115,'F4'],[116,'F5'],[117,'F6'],[118,'F7'],[119,'F8'],[120,'F9'],[121,'F10'],[122,'F11'],[123,'F12']],
        [[192,'`'],[49,'1'],[50,'2'],[51,'3'],[52,'4'],[53,'5'],[54,'6'],[55,'7'],[56,'8'],[57,'9'],[48,'0'],[189,'−'],[187,'='],[8,'Backspace','wide']],
        [[9,'Tab','wide'],[81,'Q'],[87,'W'],[69,'E'],[82,'R'],[84,'T'],[89,'Y'],[85,'U'],[73,'I'],[79,'O'],[80,'P'],[219,'['],[221,']'],[220,'\\']],
        [[20,'Caps','wide'],[65,'A'],[83,'S'],[68,'D'],[70,'F'],[71,'G'],[72,'H'],[74,'J'],[75,'K'],[76,'L'],[186,';'],[222,"'"],[13,'Enter','wide']],
        [[16,'Shift','xwide'],[90,'Z'],[88,'X'],[67,'C'],[86,'V'],[66,'B'],[78,'N'],[77,'M'],[188,','],[190,'.'],[191,'/']],
        [[17,'Ctrl','wide'],[91,'Win','wide'],[18,'Alt','wide'],[32,'Space','space'],[18,'Alt','wide'],[93,'Menu','wide'],[17,'Ctrl','wide']],
        [[37,'←'],[38,'↑'],[40,'↓'],[39,'→'],[45,'Ins'],[36,'Home'],[33,'PgUp'],[46,'Del'],[35,'End'],[34,'PgDn'],[173,'mute','wide'],[174,'volumeDown','wide'],[175,'volumeUp','wide']]
    ];
    const KEY_NAMES = new Map(KEY_ROWS.flat().map(([code, label]) => [code, label]));

    const state = {
        overlay: null, targets: [], profiles: [], profileOwners: [], assignments: [], target: null,
        profile: null, draft: null, tab: 'keyboard', dirty: false, popup: null,
        capture: null, captureSuppressed: false, requestedTarget: null, returnFocus: '', savePending: false,
        mode: 'apps', adjustingRange: null, selectedBindingIndex: -1, lastTarget: null, inputModePending: false,
        focusRequestGeneration: 0
    };

