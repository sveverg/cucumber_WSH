var Manager = (function(){

	var configPath = 'config.js';
	var reportStream = WScript.StdOut; // points to StdOut or file, specified to redirect program output
	var root;
	var selectedFeature;

	var fullPath = function(relative){
		return root.path+'\\'+relative;
	}
	return{
		fullPath: fullPath,
		getConfig: function(){
			var config = FileUtils.getFile(configPath);
			assert(config, 
				"Configuration file not found. If arguments '-c' not passed, check 'config.js' in application folder.");
			return config;
		},
		getFeatures: function(){
			return (selectedFeature) 
				? [selectedFeature]
				: FileUtils.select(root, Loader('_config').features);
		},
		getReportStream: function(){
			return reportStream;
		},
		getRoot: function(){
			return root;
		},
		report: function(msg){
			reportStream.WriteLine(msg);
		},
		selectFeature: function(path){
			selectedFeature = FileUtils.getFile(path);
			assert(selectedFeature, "Specified feature file doesn't exist");
		},
		selectFeatureByName: function(featureName){
			Loader.wait('_config', function(){
				var suitableFiles = FileUtils.select(root, Loader('_config').features)
				.filter(function(file){
					return file.name.split('.')[0] == featureName;
				});
				assert(suitableFiles.length, "Specified feature file doesn't exist");
				assert(suitableFiles.length == 1, "Too much files with same name "+quote(featureName))
				selectedFeature = suitableFiles[0];
				// TODO print relative path
				Manager.report('Selected: '+selectedFeature.path);
			});
		},
		setConfig: function(path, relative){
			configPath = (relative) ? fullPath(path) : path;
		},
		setReportStream: function(relPath){
			reportStream = FileUtils.getOutputStream(fullPath(relPath));
			return reportStream;
		},
		setRoot: function(path){
			root = FileUtils.getDirectory(path);
			assert(root, "Specified root folder doesn't exist.");
		}
	}
})();

var App = (function(){
	var checkBaselines = false;  // boolean flag for comparing reports with baselines 
	var debug = false;           // boolean flag for printing debug information
	var dumb  = true;            // boolean flag for not printing reports into console

	var importedModules = ['importFrom','World','Given','When','Then']; // dependency list for user scripts
	var output = WScript.StdOut; // points report file textStream for currently executed feature 
	
	var assert = function(cond,msg){
		if(!cond){
			if(msg != undefined){
				Manager.report('Assertion failed: '+msg);
			}
			else Manager.report('Assertion failed');
			WScript.Quit();
		}
	}
	var log = function(msg){
		if(debug) Manager.report(msg);
	};
	
	var executeFeature = function(feature, failedMatches){
		Manager.report('\n'+feature.name);
		var config = Loader('_config');
		var stepFile = undefined;
		// config.definitions contains endings, appended to the name of feature file
		if(config.definitions.some(function(appendix){
			// returns undefined, if file doesn't exist
			stepFile = FileUtils.getFile(appendToPath(feature.path, appendix));
			return stepFile;
		})) Loader.require(importedModules, function(/*modules*/){
			eval(Loader.getInjections(importedModules));
			eval(FileUtils.getContent(stepFile));
		});
		// line by line feature file execution
		var Core = Loader('_Core'), Syntax = Loader('_Syntax');
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
				// Is it necessary?
				output = Manager.getReportStream();
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
	//import of external scripts
	var World = function(relativePath /*names*/){
		assert(relativePath,
			"Function World(relativePath, name [,...]) requires at least one argument.");
		// get imported names
		var names = Array.prototype.slice.call(arguments, 1)
		.filter(function(name){
			if(name.charAt(0) == '_'){
				Manager.report("Module name "+quote(name)+" can't start with underscore character.");
				return false;
			}else if(Loader(name) !== undefined){
				Manager.report("Module name "+quote(name)+" is already used.");
				return false;
			}
			return true;
		});
		var filePath = Manager.fullPath(relativePath);
		var file = FileUtils.getFile(filePath);
		if(file) Loader.exportFrom(file, names, importedModules);
		else Manager.report("Script "+filePath+" not found.");

		names.foreach(function(name){
			if(Loader(name) !== undefined){
				importedModules.push(name);
			}
			else Manager.report("Variable "+quote(name)+" not specified in file "+file.path);
		});
	}
	Loader.define('importFrom', function(){
		return World;
	});
	Loader.define('World', function(){
		return World;
	});
	// Reading arguments
	! function(){
		var unnamed = WScript.Arguments.Unnamed;
		var arg;
		var argNum = 0; // number of current argument
		var nextArg = function(){
			return (argNum < unnamed.length) ? unnamed.Item(argNum++) : undefined;
		}
		var nextString = function(){
			assert(argNum < unnamed.length, "Key "+arg+" should be followed by string.");
			return unwrap(nextArg());
		}
		// Manager.report(unnamed.length);
		//Root folder selection
		assert(unnamed.length, "User should specify project root directory");
		Manager.setRoot(nextString());

		// Optional arguments
		arg = nextArg();
		while(arg){
			if(arg == '-c')      Manager.setConfig(nextString());
			else if(arg == '-d') debug = true;
			else if(arg == '-r') dumb = false;
			else if(arg == '-o') output = Manager.setReportStream(nextString());
			else if(arg == '-b') checkBaselines = true;
			else if(arg == '-f') Manager.selectFeature(nextString());
			else if(arg == '-F') Manager.selectFeatureByName(nextString());
			arg = nextArg();
		}
	}();
	// reading configuration file
	Loader.define('_config', function(){
		var configFile = Manager.getConfig();
		assert(configFile, "Configuration file not found. If arguments '-c' not passed, check CONFIG_PATH.");
		eval('var config = '.concat(FileUtils.getContent(configFile),';'));
		return config;
	});
	// loading main modules
	Loader.define(['_Core','_Syntax'],['_config'],function(config){
		//script load
		var scriptFiles = FileUtils.select(FileUtils.getDirectory('cucumber'), '*.js'
		).flatten_one();
		for (var i = 0; i < scriptFiles.length; i++) {
			Manager.report(scriptFiles[i]);
			eval(FileUtils.getContent(scriptFiles[i]));
		};
		return [Core, Syntax];
	});
	// define main keywords
	Loader.define(['Given','When','Then'],['_Core'],function(Core){
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
	Loader.require(importedModules, function(/*module links*/){
		var scriptFiles = FileUtils.select(Manager.getRoot(), Loader('_config').scripts);
		//including dependencies
		log('Injections');
		eval(Loader.getInjections(importedModules));
		// loading scripts
		log('\nUser-specified modules');
		for (var i = 0; i < scriptFiles.length; i++) {
			Manager.report(scriptFiles[i]);
			eval(FileUtils.getContent(scriptFiles[i]));
		};
	});

	return{
		alert: function(msg){
			output.WriteLine(msg);
			if( !dumb) Manager.report(msg);
		},
		assert: assert,
		console: Manager.report,
		debug: debug,
		exit: function(){
			Manager.getReportStream().close();
		},
		getConfigValue: function(key){
			return Loader('_config')[key];
		},
		run: function(){
			var featureFiles = Manager.getFeatures();
			if( !featureFiles.length){
				alert('Warning: no feature files found.');
			}
			// to track features, whose reports don't match baselines
			var failedMatches = [];
			for (var i = 0; i < featureFiles.length; i++) {
				executeFeature(featureFiles[i], failedMatches);
			};
			// baseline matching report
			if(checkBaselines && failedMatches.length){
				Manager.report("These reports don't match baselines:");
				failedMatches.foreach(alert);
			}else if(checkBaselines) Manager.report('All baselines match reports');
		}
	}
})();
var alert = App.alert;
App.run();
App.exit();