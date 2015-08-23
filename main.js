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
		select : function(root, path){
			list = [];
			pathExps = path.split('\\').map(function(part){
				part = part.replace(/\*/, '.*');
				part = part.replace(/\?/, '.?');
				return new RegExp(part);
			});
			search(root, 0);
			return list;
		},
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

	var VOID_OBJECT = {};
	
	//internal dependency storage
	var Namespace = {};
	// dependency list for user scripts
	var importedModules = ['World','Given','When','Then']; 
	
	var checkBaselines = false;
	var debug = false;           // boolean flag for printing debug information
	var dumb  = true;            // boolean flag for not printing reports into console
	var output = WScript.StdOut; // points report file testStream for currently executed feature 
	var root;                    // project root folder
	var selectedFeature;         // feature, selected for standalone execution by -f key(if any)
	
	var alert = function(msg){
		output.WriteLine(msg);
		if( !dumb && output != WScript.StdOut) WScript.Echo(msg);
	};
	var appendToPath = function(path, annex){
		return path.split('.')[0].concat(annex);
	};
	var log = function(msg){
		if(debug) WScript.Echo(msg);
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
	var equal = function(shell, file1, file2){
		return shell.Run('fc '+file1+' '+file2, 7, WaitOnReturn) == 0;
	};
	var getInjections = function(){
		var injections = [];
		for (var i = 0; i < importedModules.length; i++) {
			injections[i] = 'var '.concat(importedModules[i],' = arguments[',i,'];');
			log(injections[i]);
		};
		return injections.join('\n');
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
				eval(FileUtils.getContent(file));
				Namespace[name] = Image;
				importedModules.push(name);
			}else{
				alert("Script "+quote(root.path+'\\'+relativePath)+" not found.");
			}
		}
	});
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
	// reading configuration file
	define('_config', function(){
		var configFile = FileUtils.getFile(CONFIG_PATH);
		assert(configFile, "Configuration file not found. Please, check CONFIG_PATH.");
		eval('var config = '.concat(FileUtils.getContent(configFile),';'));
		return config;
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
			if(arg == '-d'){
				debug = true;
			}else if(arg == '-r'){
				dumb = false;
			}else if(arg == '-b'){
				checkBaselines = true;
			}else if(arg == '-f' && i < unnamed.length-1){
				var featurePath = unwrap(unnamed.Item(i+1));
				selectedFeature = FileUtils.getFile(featurePath);
				assert(selectedFeature, "Specified feature file doesn't exist");
				i++;
			}else if(arg == '-F' && i < unnamed.length-1){
				var featureName = unwrap(unnamed.Item(i+1));
				var suitableFiles = Namespace['_config'].features.map(function(featurePath){
					return FileUtils.select(root, featurePath);
				}).flatten_one().filter(function(file){
					return file.name.split('.')[0] == featureName;
				});
				assert(suitableFiles.length, "Specified feature file doesn't exist");
				if(suitableFiles.length == 1){
					selectedFeature = suitableFiles[0];
					alert(selectedFeature.name);
				}else{
					alert("Too much files with same name "+quote(featureName));
				}
				i++;
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
		// searching scripts
		var scriptFiles = config.scripts.map(function(scriptPath){
			return FileUtils.select(root, scriptPath);
		}).flatten_one();
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
			WScript.Echo(msg);
		},
		run: function(){
			var failedMatches = [];
			require(['_config','_Syntax'], function(_config, _Syntax){
				var featureFiles;
				if( !selectedFeature){
					featureFiles = _config.features.map(function(featurePath){
						return FileUtils.select(root, featurePath);
					}).flatten_one();
					if( !featureFiles.length) alert('Warning: no feature files found.');
				}else{
					featureFiles = [selectedFeature];
				}
				featureFiles.foreach(function(feature){
					alert('\n'+feature.name);
					loadDefinitions(feature);
					FileUtils.setIO(
						feature.path,                               //input path
						appendToPath(feature.path, _config.report), //output path
						// called after files opened and before closed
						function(stream, outStream){
							output = outStream;
							_Syntax.start();
							while(!stream.AtEndOfLine){
								_Syntax.parse(stream.ReadLine());
							}
							_Syntax.finish();
						}
					);
					output = WScript.StdOut;
					if(checkBaselines){
						var report   = FileUtils.getFile(appendToPath(feature.path, _config.report));
						var baseline = FileUtils.getFile(appendToPath(feature.path, _config.baseline));
						if(baseline && !FileUtils.compare(report, baseline)){
							failedMatches.push(report.name);
						}
					}
				});
				if(checkBaselines && failedMatches.length){
					alert("These reports don't match baselines:");
					failedMatches.foreach(alert);
				}else if(checkBaselines) alert('All baselines match reports');
			});
		},
		StdOut: output
	}
})();
var alert = App.alert;
App.run();