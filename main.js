var VOID_OBJECT = {};
var assert = function(cond,msg){
	if(!cond){
		if(msg != undefined){
			WScript.Echo('Assertion failed: '+msg);
		}else WScript.Echo('Assertion failed');
		WScript.Quit();
	}
};
var isArray = function(obj){
	return (obj instanceof Array);
};
assert(isArray([2,4]), "isArray([2,4]) is false");
assert( !isArray(24), "isArray(24) is true"); 

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
var unwrap = function(str){
	if(str.last() == '"' && str.charAt(0) == '"'){
		str = str.substring(1, str.length-1);
	}
	return str;
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
//underscore flatten with shallow = 1
Array.prototype.flatten_one = function(){
	return Array.prototype.concat.apply([], this);
} 
Array.prototype.foreach = function(func){
	for (var i = 0; i < this.length; i++) {
		func(this[i]);
	};
};
Array.prototype.indexOf = function(elem){
	for (var i = this.length - 1; i >= 0; i--) {
		if(this[i] === val) return i;
	};
	return -1;
}
Array.prototype.is = function(val){
	return this.length == 1 && this[0] == val;
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
// Polyfill, taken from https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Function/bind
// Part about prototypes is removed
Function.prototype.bind = function(oThis) {
	if (typeof this !== 'function') {
		// closest thing possible to the ECMAScript 5
		// internal IsCallable function
		throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
	}
	var aArgs   = Array.prototype.slice.call(arguments, 1),
		fToBind = this,
		fNOP    = function() {},
		fBound  = function() {
			return fToBind.apply(this instanceof fNOP
				? this
				: oThis,
				aArgs.concat(Array.prototype.slice.call(arguments))
			);
		};
	// if (this.prototype) {
	//   // native functions don't have a prototype
	//   fNOP.prototype = this.prototype; 
	// }
	// fBound.prototype = new fNOP();
	return fBound;
};
// Poor substitution for JSON.stringify
Object.prototype.content = function(preq){
	var str = '';
	if(!preq) preq='';
	for(key in this){
		if(this.hasOwnProperty(key) && this[key] !== undefined){
			str=str.concat('\n',preq,key,': ',this[key]);
		}
	};
	return str.slice(1); //remove first \n
};
String.prototype.last = function(){
	return this.charAt(this.length-1);
}

var FileUtils = (function(){
	var FSO = new ActiveXObject("Scripting.FileSystemObject");
	var ForReading = 1;
	var ForWriting = 2;
	var SHELL = WScript.CreateObject('WScript.Shell');
	var WaitOnReturn = true;

	//contains selected files
	var list = [];
	var pathExps;

	//impossible to make it method
	var foreachInCollection = function(collection, func){
		var enumerator = new Enumerator(collection);
		for (; !enumerator.atEnd(); enumerator.moveNext()) func(enumerator.item());
	};
	var getContent = function(file){
		var stream = FSO.OpenTextFile(file.path, ForReading);
		var str = stream.ReadAll();
		stream.Close();
		return str;
	};

	var search = function(currentFolder, position){
		var arr = [];
		var exp = pathExps[position];
		if(position == pathExps.length-1){
			foreachInCollection(currentFolder.files, function(file){
				if(exp.test(file.name)){
					list.push(file);
				}
			});
		}else{
			foreachInCollection(currentFolder.subfolders, function(subfolder){
				if(exp.test(subfolder.name)){
					search(subfolder, position+1);
				}
			});
		}
		return arr;
	};

	return{
		// are files identical
		compare: function(file1, file2){
			return SHELL.run('fc '+file1.path+' '+file2.path, 7, WaitOnReturn) == 0;
		},
		getContent: getContent,
		getDirectory: function(path){
			return (FSO.FolderExists(path)) ? FSO.GetFolder(path) : undefined;
		},
		getFile: function(path){
			return (FSO.FileExists(path)) ? FSO.GetFile(path) : undefined;
		},
		getOutputStream: function(path){
			return FSO.OpenTextFile(path, ForWriting, true);
		},
		// Select from folder 'root' files, specified by 'path',
		// which can contain wildcard characters
		select : function(root, pathData){
			var getFiles = function(root, path){
				list = [];
				pathExps = path.split('\\').map(function(part){
					part = part.replace(/\*/, '.*');
					part = part.replace(/\?/, '.?');
					return new RegExp(part);
				});
				search(root, 0);
				return list;
			}
			return isArray(pathData) 
				? pathData.map(getFiles.bind(undefined, root)).flatten_one() 
				: getFiles(root, pathData);
		},
		// create input and output streams for specified files and send them to callback
		setIO: function(inputPath, outputPath, callback){
			var inputStream = FSO.OpenTextFile(inputPath, ForReading);
			var outputStream = FSO.OpenTextFile(outputPath,ForWriting, true);
			callback(inputStream, outputStream);
			inputStream.Close();
			outputStream.Close();
		}
	}
})();

var App = (function(){
	var CONFIG_PATH = 'config.js';
	
	//internal dependency storage
	var Namespace = {};
	// dependency list for user scripts
	var importedModules = ['World','Given','When','Then']; 
	
	var checkBaselines = false;
	var configPath = CONFIG_PATH;
	var debug = false;           // boolean flag for printing debug information
	var dumb  = true;            // boolean flag for not printing reports into console
	var output = WScript.StdOut; // points report file textStream for currently executed feature 
	var reportStream = output;   // points to StdOut or file, specified to redirect program output
	var root;                    // project root folder
	var selectedFeature;         // feature, selected for standalone execution by -f key(if any)
	var selectedName;            // name of selected feature
	
	var alert = function(msg){
		// WScript.Echo('alert'+msg);
		output.WriteLine(msg);
		if( !dumb && output != reportStream) reportStream.WriteLine(msg);
	};
	var appendToPath = function(path, annex){
		return path.split('.')[0].concat(annex);
	};
	var log = function(msg){
		if(debug) reportStream.WriteLine(msg);
	};
	//poor substitution of dependency injection
	var define = function(declaration, arg2, arg3){
		var definition, dependencies;
		if(typeof arg2 == 'function'){
			definition = arg2;
			dependencies = [];
		}else{
			definition = arg3;
			dependencies = arg2;
		}
		var result = definition.apply(VOID_OBJECT, dependencies.map(function(name){
			return Namespace[name];
		}));
		if(isArray(declaration)){
			assert(isArray(result), "Definition of "+declaration+" should return array.");
			for (var i = 0; i < declaration.length; i++) {
				Namespace[declaration[i]] = result[i];
			};
		}else if(result !== undefined){
			Namespace[declaration] = result;
		}
	};
	var executeFeature = function(feature, config, Syntax, failedMatches){
		alert('\n'+feature.name);
		loadDefinitions(feature);
		FileUtils.setIO(
			feature.path,                               //input path
			appendToPath(feature.path, config.report), //output path
			// called after files opened and before closed
			function(stream, outStream){
				output = outStream;
				Syntax.start();
				while(!stream.AtEndOfLine){
					Syntax.parse(stream.ReadLine());
				}
				Syntax.finish();
				output = reportStream;
			}
		);
		if(checkBaselines){
			var report   = FileUtils.getFile(appendToPath(feature.path, config.report));
			var baseline = FileUtils.getFile(appendToPath(feature.path, config.baseline));
			if(baseline && !FileUtils.compare(report, baseline)){
				failedMatches.push(report.name);
			}
		}
	}
	var getInjections = function(){
		var injections = [];
		for (var i = 0; i < importedModules.length; i++) {
			injections[i] = 'var '.concat(importedModules[i],' = arguments[',i,'];');
			log(injections[i]);
		};
		return injections.join('\n');
	}
	// loads specific step definitions for feature file, if there are any
	var loadDefinitions = function(feature){
		var config  = Namespace['_config'];
		var stepFile = undefined;
		// config.definitions contains endings, appended to the name of feature file
		if(config.definitions.some(function(appendix){
			var defsPath = appendToPath(feature.path, appendix);
			// return undefined, if file doesn't exist
			stepFile = FileUtils.getFile(defsPath);
			return stepFile;
		}))	require(importedModules, function(/*module links*/){
			log(stepFile);
			eval(getInjections());
			eval(FileUtils.getContent(stepFile));
		});
	}
	var require = function(dependencies, func){
		func.apply(VOID_OBJECT, dependencies.map(function(name){
			return Namespace[name];
		}));
	}
	//TEMPORARY import of external scripts
	define('World', function(){
		return function(name, relativePath){
			assert(name.charAt(0) != '_', "Module name "+quote(name)+" can't start with underscore character.");
			assert(Namespace[name] === undefined, "Module name "+quote(name)+" should be unique.");
			assert(relativePath, "Function World(name, relativePath) called with wrong arguments number.")

			var file = FileUtils.getFile(root.path+'\\'+relativePath);
			if(file){
				var content = FileUtils.getContent(file);
				content = content.concat('\nNamespace[',quote(name),'] = ',name);
				alert(content);
				eval(content);
				if(Namespace[name] !== undefined){
					importedModules.push(name);
				}
				else alert("Variable "+quote(name)+" not specified in file "+file.path);
			}else{
				alert("Script "+quote(root.path+'\\'+relativePath)+" not found.");
			}
		}
	});
	// Reading arguments
	! function(){
		var unnamed = WScript.Arguments.Unnamed;

		//Root folder selection
		assert(unnamed.length, "User should specify project root directory");
		var rootPath = unwrap(unnamed.Item(0));
		root = FileUtils.getDirectory(rootPath);
		assert(root, "Specified root folder doesn't exist.");

		// Optional arguments
		var arg;
		for(var i = 1; i < unnamed.length; i++){
			arg = unnamed.Item(i);
			log(arg);
			if(arg == '-c'){
				configPath = unwrap(unnamed.Item(i+1));
				i++;
			}if(arg == '-d'){
				debug = true;
			}else if(arg == '-r'){
				dumb = false;
			}else if(arg == '-o'){
				var relativePath = unwrap(unnamed.Item(i+1));
				i++;
				reportStream = FileUtils.getOutputStream(relativePath, root);
				output = reportStream;
			}else if(arg == '-b'){
				checkBaselines = true;
			}else if(arg == '-f' && i < unnamed.length-1){
				var featurePath = unwrap(unnamed.Item(i+1));
				selectedFeature = FileUtils.getFile(featurePath);
				assert(selectedFeature, "Specified feature file doesn't exist");
				i++;
			}else if(arg == '-F' && i < unnamed.length-1){
				selectedName = unwrap(unnamed.Item(i+1));
				i++;
			}
		}
	}();
	// reading configuration file
	define('_config', function(){
		var configFile = FileUtils.getFile(configPath);
		assert(configFile, "Configuration file not found. If arguments '-c' not passed, check CONFIG_PATH.");
		eval('var config = '.concat(FileUtils.getContent(configFile),';'));
		return config;
	});
	// TODO split class
	! function(){
		if(selectedName){
			var suitableFiles = FileUtils.select(root, Namespace['_config'].features)
			.filter(function(file){
				return file.name.split('.')[0] == selectedName;
			});
			assert(suitableFiles.length, "Specified feature file doesn't exist");
			if(suitableFiles.length == 1){
				selectedFeature = suitableFiles[0];
				alert('Selected: '+selectedFeature.name);
			}else{
				alert("Too much files with same name "+quote(featureName));
			}
		}
	}();
	// loading main modules
	define(['_Core','_Syntax'],['_config'],function(config){
		//script load
		var scriptFiles = FileUtils.select(
			FileUtils.getDirectory('cucumber'), 
			'*.js'
		).flatten_one();
		for (var i = 0; i < scriptFiles.length; i++) {
			alert(scriptFiles[i]);
			eval(FileUtils.getContent(scriptFiles[i]));
		};
		return [Core, Syntax];
	});
	// define main keywords
	define(['Given','When','Then'],['_Core'],function(Core){
		return ['Given','When','Then'].map(function(keyword){
			return function(reg, func){
				Core.pushDefinition(keyword, {
					reg: reg,
					func: func
				});
			};
		});
	});
	// loading user-specified modules(can include step definitions)
	require(importedModules, function(/*module links*/){
		var config = Namespace['_config'];
		var scriptFiles = FileUtils.select(root, config.scripts);
		//including dependencies
		log('Injections');
		eval(getInjections());
		// loading scripts
		log('\nUser-specified modules');
		for (var i = 0; i < scriptFiles.length; i++) {
			alert(scriptFiles[i]);
			eval(FileUtils.getContent(scriptFiles[i]));
		};
	});

	return{
		alert: alert,
		debug: debug,
		console: function(msg){
			reportStream.WriteLine(msg);
		},
		exit: function(){
			reportStream.close();
		},
		getConfigValue: function(key){
			return Namespace['_config'][key];
		},
		run: function(){
			var failedMatches = [];
			require(['_config','_Syntax'], function(config, Syntax){
				var featureFiles = ( !selectedFeature)
					? FileUtils.select(root, config.features)
					: [selectedFeature];
				if( !featureFiles.length){
					alert('Warning: no feature files found.');
				}
				for (var i = 0; i < featureFiles.length; i++) {
					executeFeature(featureFiles[i], config, Syntax, failedMatches);
				};
				// baseline matching report
				if(checkBaselines && failedMatches.length){
					alert("These reports don't match baselines:");
					failedMatches.foreach(alert);
				}else if(checkBaselines) alert('All baselines match reports');
			});
		}
	}
})();
var alert = App.alert;
App.run();
App.exit();