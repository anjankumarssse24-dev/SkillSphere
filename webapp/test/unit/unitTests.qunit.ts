/* @sapUiRequire */
/* eslint-disable @typescript-eslint/no-explicit-any */

QUnit.config.autostart = false;

// import all your QUnit tests here
void Promise.all([
	import("sap/ui/core/Core"), // Required to wait until Core has booted to start the QUnit tests
import("unit/controller/View1Page.controller")
]).then(([{default: Core}]) => Core.ready()).then(() => {
	QUnit.start();
});