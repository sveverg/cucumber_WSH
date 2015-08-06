var alert = function(msg){
	App.StdOut.WriteLine(msg);
	WScript.Echo(msg);
};
var assert = function(cond,msg){
	if(!cond){
		if(msg != undefined){
			WScript.Echo('Assertion failed: '+msg);
		}else WScript.Echo('assertion failed');
	}
};
var quote = function(){
	return '"'.concat(Array.prototype.join.call(arguments,''),'"');
};
var trim = function(str){
	var first = str.search(/\S/);
	if(first != -1){
		var trailing = str.search(/(\s+)$/);
		return (trailing != -1) ? str.substr(first,trailing-first) : str.substr(first);
	}else{
		return "";
	}
};

/*Self-modification method, not great */
Array.prototype.apply = function(func){
	for (var i = 0; i < this.length; i++) {
		this[i] = func(this[i]);
	};
	return this; 
};
Array.prototype.contains = function(val){
	for (var i = this.length-1; i >= 0; i--) {
		if(this[i] === val) return true;
	};
	return false;
};
Array.prototype.every = function(func){
	var i = 0;
	while(i < this.length && func(this[i]))	i++;
	return i == this.length;
};
Array.prototype.filter = function(func){
	var arr = [];
	for (var i = 0; i < this.length; i++) {
		if(func(this[i])) arr.push(this[i]);
	};
	return arr;
};
Array.prototype.foreach = function(func){
	for (var i = 0; i < this.length; i++) {
		func(this[i]);
	};
};
// TEMPORARY
Array.prototype.forfurther = function(num, func){
	for (var i = num+1; i < this.length; i++) {
		func(this[i]);
	};
};
Array.prototype.indexOf = function(elem){
	for (var i = this.length - 1; i >= 0; i--) {
		if(this[i] === val) return i;
	};
	return -1;
}
Array.prototype.last = function(){
	return this[this.length-1];
};
Array.prototype.map = function(func){
	var arr = [];
	for (var i = 0; i < this.length; i++) {
		arr[i] = func(this[i]);
	};
	return arr; 
};
Array.prototype.some = function(func){
	var i = 0;
	while(i < this.length && !func(this[i]))	i++;
	return i != this.length;
};
// Poor substitution for JSON.stringify
Object.prototype.content = function(preq){
	var str = '';
	if(!preq) preq='';
	for(key in this){
		if(this.hasOwnProperty(key)){
			str=str.concat('\n',preq,key,': ',this[key]);
		}
	};
	return str.slice(1); //remove first \n
};
String.prototype.last = function(){
	return this.charAt(this.length-1);
}

var App = (function(){
	var FSO = new ActiveXObject("Scripting.FileSystemObject");
	var ForReading = 1;
	var ForWriting = 2;

	var debug;

	var lineNumber = 0;

	var output = WScript.StdOut;

	var addToName = function(fileName, annex){
		return fileName.split('.')[0].concat(annex);
	}

	var unnamed = WScript.Arguments.Unnamed;
	var named = WScript.Arguments.Named;
	debug = (named.Exists("debug") && named.Item("debug") == "true"); 

	var files = [];
	var fileFilter = undefined;
	for(var i = 0; i < unnamed.length; i++){
		files[i] = unnamed.Item(i);
		WScript.Echo(files[i]);
	}
	var featureFile, stepFile, reportFile;
	// TODO add multifile support
	if(files.length){
		featureFile = files[0];
		stepFile = addToName(featureFile,'_defs.js');
		reportFile = addToName(featureFile,'_report.txt');
		var output = FSO.OpenTextFile(reportFile, ForWriting, true);
	}else{
		// featureFile = 'cat.feature';
		// stepFile = 'cat_defs.js';
		alert('Script requires one argument: path to feature file.');
		WScript.Quit();
	}

	var Engine = (function(){
		var stream = FSO.OpenTextFile('flow.js',ForReading);
		var str = stream.ReadAll();
		eval(str);
		stream.Close();

		var stream = FSO.OpenTextFile('engine.js',ForReading);
		var str = stream.ReadAll();
		eval(str);
		stream.Close();

		stream = FSO.OpenTextFile('steps.js',ForReading);
		var str = stream.ReadAll();
		eval(str);
		stream.Close();

		if(FSO.FileExists(stepFile)){
			stream = FSO.OpenTextFile(stepFile,ForReading);
			var str = stream.ReadAll();
			eval(str);
			stream.Close();
		}
		return Engine;
	})();

	var Syntax = (function(){
		stream = FSO.OpenTextFile('syntax.js',ForReading);
		var str = stream.ReadAll();
		eval(str);
		stream.Close();
		return Syntax;
	})();

	return{
		debug: debug,
		gotError: false,
		lineNumber: function(){
			return lineNumber;
		},
		run: function(){
			var stream = FSO.OpenTextFile(featureFile, ForReading);
			while(!stream.AtEndOfLine){
				Syntax.parse(stream.ReadLine());
			}	
			stream.Close();
			Syntax.finish();
			output.Close();
		},
		StdOut: output
	}
})();
App.run();