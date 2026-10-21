// Only injected into app frames by the isolated QA driver. No production page
// loads this file. Reuse the exact already-running application module.
import {operations,saveNow,sessionStatus,handoff,completion} from '../app.js';
window.scoreDeskQA={operations,saveNow,sessionStatus,handoff,completion};
