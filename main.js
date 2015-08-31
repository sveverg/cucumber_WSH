var VOID_OBJECT = {};
var assert = function(cond,msg){
	if(!cond){
		if(msg != undefined){
			Manager.report('Assertion failed: '+msg);
		}
		else Manager.report('Assertion failed');
		WScript.Quit();
	}
}
var isArray = function(obj){
	return (obj instanceof Array);
};
assert(isArray([2,4]), "isArray([2,4]) is false");
assert( !isArray(24), "isArray(24) is true"); 

var appendToPath = function(path, annex){
	return path.split('.')[0].concat(annex);
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

var Loader = (function(){
	// used only once, so not checked everywhere
	var loadCallbacks = {};
	//internal dependency storage
	var Namespace = {};

	var setName = function(name, value){
		Namespace[name] = value;
		if(loadCallbacks[name]) loadCallbacks[name]();
	}

	var Loader = function(key){
		return Namespace[key];
	}
	Loader.define = function(declaration, arg2, arg3){
		var definition, dependencies;
		if(typeof arg2 == 'function'){
			definition = arg2;
			dependencies = [];
		}else{
			definition = arg3;
			dependencies = arg2;
		}
		var result = definition.apply(undefined, dependencies.map(function(name){
			return Namespace[name];
		}));
		if(isArray(declaration)){
			assert(isArray(result), "Definition of "+declaration+" should return array.");
			for (var i = 0; i < declaration.length; i++) {
				setName(declaration[i], result[i]);
			};
		}else if(result !== undefined){
			setName(declaration, result);
		}
	}
	Loader.exportFrom = function(script, names, dependencies){
		Loader.require(dependencies, function(){
			eval(Loader.getInjections(dependencies));
			var content = FileUtils.getContent(script);
			eval(content.concat(
				names.map(function(name){
					return '\nNamespace['.concat(quote(name),'] = ',name);
				}).join('')
			));
		});
	}
	Loader.getInjections = function(modules){
		var injections = [];
		for (var i = 0; i < modules.length; i++) {
			injections[i] = 'var '.concat(modules[i],' = arguments[',i,'];');
			// Manager.report(injections[i]);
		};
		return injections.join('\n');
	}
	Loader.require = function(dependencies, func){
		func.apply(VOID_OBJECT, dependencies.map(function(name){
			return Namespace[name];
		}));
	}
	Loader.wait = function(name, handler){
		loadCallbacks[name] = handler;
	}
	return Loader;
})();

var appFile = FileUtils.getFile('app.js');
assert(appFile, 'File app.js in application folder required');
eval(FileUtils.getContent(appFile));