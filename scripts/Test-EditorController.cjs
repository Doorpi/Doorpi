// Runs the actual dispatch loop once per surface, without a connected controller.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../Doorpi/Frontend/scripts/navigation/110-gamepad-dispatch-loop.js'),'utf8');
function run({menu=false,wizard=false,keyboard=false}={}){
 let saves=0,confirms=0;const errors=[];
 const context={window:{isDoorpiFocused:true,isNavMenuOpen:menu,_editModalSave:()=>saves++,_vkbConfirm:()=>confirms++},
  document:{getElementById:()=>null,hasFocus:()=>true},console:{error:(...args)=>errors.push(args.join(' '))},performance,
  NAV:{GAMEPAD:{BTN_START:9}},readAllGamepadInput:()=>({buttons:[]}),isVkbOpenForNavigation:()=>keyboard,
  isDoorpiActionQuarantineActive:()=>false,isDoorpiGameInputSuppressed:()=>false,gamepadDirection:()=>null,axisDirection:()=>null,
  primaryJustPressed:()=>false,buttonJustPressed:(_,index)=>index===9,handleArtworkWizardGamepadShortcuts:()=>wizard,
  isCtxMenuOpen:false,isEditModalOpen:true,isSetupOpen:false,isModalOpen:false,_cursorHoldState:{},requestAnimationFrame(){}};
 vm.runInNewContext(source,context);assert.deepEqual(errors,[]);return {saves,confirms};
}
assert.deepEqual(run(),{saves:1,confirms:0});
assert.deepEqual(run({menu:true}),{saves:1,confirms:0});
assert.equal(run({wizard:true}).saves,0,'Artwork keeps priority over editor Save');
assert.equal(run({menu:true,wizard:true}).saves,0);
assert.deepEqual(run({keyboard:true}),{saves:0,confirms:1},'Start confirms keyboard before committing editor');
console.log('PASS: Start saves in Home/library editors; artwork and keyboard keep input priority.');
