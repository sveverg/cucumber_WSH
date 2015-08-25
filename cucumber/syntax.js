var DEBUG = true;
var debug = function(msg){
	if(DEBUG && App.debug) alert(msg);
};

//TODO describe chain
var GherkinLine = (function(){
	function GherkinLine(line){
		this.val = line;
	}; 
	// This construction is used to describe sequence of mutually exclusive blocks.
	// Passed block interrupts any attempt to execute blocks down the sequence
	//      by returning Idle object with empty methods.
	// Block fails, when its condition fails or handler returns true.
	//      In that case next blocks will be attempted to execute.
	// If condition fails, block handler will never be called.
	GherkinLine.prototype.chain = function(condition, handler){
		return (condition && !(handler && handler.call(this)) ) ? Idle : this;
	};
	GherkinLine.prototype.other = function(handler){
		handler.call(this);
	};
	// Last argument is interpreted like handler function, previous like matching patterns.
	// Each pattern can be string or string array.
	// In case of coincidence, function stores suited value at this.firstPart,
	//                           and the rest part of string at this.lastPart.
	GherkinLine.prototype.startsWith = function(/*patterns, handler*/){
		var p_this = this;
		var startsWithString = function(str){
			if(p_this.val.substr(0, str.length) == str){
				p_this.firstPart = str;
				p_this.lastPart = trim(p_this.val.substr(str.length));
				return true;
			}
			else return false;
		}
		// if last argument is function, exclude it from pattern list
		if(typeof arguments[arguments.length-1] == 'function'){
			var handler = Array.prototype.pop.call(arguments);
		}
		return this.chain(
			Array.prototype.some.call(arguments, function(pattern){
				// TEMPORARY array check 
				return (pattern[0]) ? pattern.some(startsWithString) : startsWithString(pattern);
			}),
		handler);
	};
	var Idle = {};
	for(key in GherkinLine.prototype){
		if(typeof GherkinLine.prototype[key] == 'function'){
			Idle[key] = function(){
				return Idle;
			}
		}
	};
	GherkinLine.prototype.PASSED = Idle;
	return GherkinLine;
})();


var DOC_STRING_MARK      = '"""';
var BACKGROUND_ANNOTATION= 'Background:';
var AFTERWARD_ANNOTATIONS= ['Epilog:','Epilogue:','Afterward:','Afterwards:','Afterword:'];
var EXAMPLES_ANNOTATION  = 'Examples:';
var FEATURE_ANNOTATION   = 'Feature:';
var FINALLY_ANNOTATION   = 'Finally:';
var OUTLINE_ANNOTATION   = 'Scenario Outline:';
var PROCEDURE_ANNOTATION = 'GivenProcedure:';
var SCENARIO_ANNOTATION  = 'Scenario:';

var SCENARIO_HEADINGS  = [SCENARIO_ANNOTATION, OUTLINE_ANNOTATION];
var MAIN_BLOCK_HEADINGS = [FEATURE_ANNOTATION, FINALLY_ANNOTATION, PROCEDURE_ANNOTATION, SCENARIO_HEADINGS].flatten_one();
var STEP_KEYWORDS = ['Given','When','Then','And','But'];

/* 
 * It's important to keep previous feature step in buffer, so that you could add DocString or table to it,
 * check propriety of the keyword sequence and define meaning of keywords 'And' and 'But'. */
 
var Buffer = (function(){
	// rules, which define correct keyword sequence
	var FOLLOWERS = {
		Given: ['Given','When','Then'],
		When: ['When','Then'],
		Then: ['When', 'Then']
	};
	// Keywords, which meaning should be defined
	var DOUBTFUL = ['And','But'];

	// Takes values 'Given', 'When' or 'Then', which specifies kind of previous step
	var previousKeyword;
	// Contains previous loaded step, immediately cleared after its execution
	var stepBuffer;

	// If buffer contains any step, engineAction's preformed on it. 
	// These actions are performed together, otherwise not cleaning buffer mistakenly 
	// causes step to be executed twice.
	var run_n_purge = function(arg){
		if(stepBuffer){
			debug('Buffer executes: '+stepBuffer);
			if(arg) debug("      with argument "+arg);
			// TODO test #4.1
			Engine.appendToLoading(previousKeyword, stepBuffer, arg);
			stepBuffer = undefined;
		}
	}

	var stepError = function(msg, keyword, step){
		if(keyword) msg = msg.concat('\nIn step "',keyword);
		if(step)    msg = msg.concat(' ',step);
		Engine.catchSyntaxError(msg+'"');
	}

	return{
		addArgument: function(arg){
			if(stepBuffer){
				run_n_purge(arg);
			}else{
				// TEMPORARY until we have line numbers
				Engine.catchSyntaxError("No suitable step for this argument "+arg);
			}
		},
		addExamples: function(examples, exampleTags){
			run_n_purge();
			Engine.runOutline(examples, exampleTags);
			debug('clear engineAction');
			engineAction = undefined; // #4.1 scenario steps after examples are not permitted
		},
		finish: function(){
			debug('Buffer.finish()');
			run_n_purge();
			Engine.finishLoad();
			Engine.finishFeature();
		},
		load: function(gLine, step){
			var keyword = gLine.firstPart;
			debug('Buffer loaded: '+step);
			gLine.startsWith(DOUBTFUL,function(){
				if(previousKeyword){
					run_n_purge();
					stepBuffer = step;
				}else{
					stepError("Unexpected first keyword "+quote(keyword), gLine.firstPart, step);
				}
			})
			.other(function(){
				if(!previousKeyword || FOLLOWERS[previousKeyword].contains(keyword)){
					run_n_purge();
					previousKeyword = keyword;
					stepBuffer = step;
				}else{
					stepError("Unexpected keyword ".concat(
						quote(keyword),' after keyword ',quote(previousKeyword) ),
						gLine.firstPart, step
					);
				}
			});
		},
		/*Executes any stored command and clears buffer
		* According to wrappedWord type modifies engineAction and calls proper Engine method 
		* arg can be list of procedure arguments or list of scenario tags) */
		newBlock: function(gLine, name, arg){
			run_n_purge();
			previousKeyword = undefined;
			gLine.startsWith(FINALLY_ANNOTATION,function(){
				Engine.addFinallyBlock();
			})
			// executed, if not FINALLY_ANNOTATION
			.chain(true, function(){
				Engine.finishLoad();
				return true; // continue chain execution
			})
			.startsWith(AFTERWARD_ANNOTATIONS, function(){
				Engine.addAfterward();
			})
			.startsWith(BACKGROUND_ANNOTATION, function(){
				Engine.addBackground();
			})
			.startsWith(FEATURE_ANNOTATION, function(){
				Log.summarizeFeature();
				Engine.finishFeature();
				Log.announceFeature(trim(gLine.lastPart));
			})
			.startsWith(PROCEDURE_ANNOTATION, function(){
				Engine.newProcedure(name, arg);
			})
			.startsWith(SCENARIO_HEADINGS, function(){
				Engine.newScenario(name, arg);
			})
			.other(function(word){
				Engine.catchSyntaxError("Wrong block kind "+word);
			})
		},
		sendError: function(msg){
			run_n_purge();
			Engine.catchSyntaxError(msg);
		}
	}
})();

var Postponer = (function(){
	var active = true;
	var cyclic = false;
	var func;
	var lexemes;

	var await = function(_lexemes, _func, _cyclic, _active){
		Postponer.triggered = true;
		cyclic = _cyclic;
		func = _func;
		// transform arguments to array
		lexemes = Array.prototype.map.call(_lexemes, function(x){return x;});
		active = _active;
	}

	return{
		// This method context is GherkinLine
		// operation order is designed to give postponed action unchanged value of
		// Postpone.triggered and capability to set it false 
		act: function(){
			var res;
			if((this.startsWith.apply(this, lexemes) != this.PASSED) == active){
				res = (active) ? func.call(this) !== false : true;
				if( !cyclic) Postponer.triggered = false; 
			}else{
				res = (active) ? true : func.call(this) !== false;
				Postponer.triggered = false;
			}
			return res;
		},
		awaited: function(lexeme){
			return Postponer.triggered && lexemes.contains(lexeme);
		},
		callIfNot: function(){
			var handler = Array.prototype.pop.call(arguments);
			assert(typeof handler == 'function', "Last Postponer wait() argument should be function");
			await(arguments, handler, false, true);
		},
		doUntil: function(){
			var handler = Array.prototype.pop.call(arguments);
			assert(typeof handler == 'function', "Last Postponer doUntil() argument should be function");
			await(arguments, handler, true, true);
		},
		triggered: false,
		waitWhile: function(){
			var handler = Array.prototype.pop.call(arguments);
			assert(typeof handler == 'function', "Last Postponer waitWhile() argument should be function");
			await(arguments, handler, true, false);
		}
	}
})();

var Syntax = (function(){
	// array to store DocStrings and DataTables
	var argBuffer = [];
	// whether program checks existence of <variables> in the line
	var checkVariables = false;
	// skip sentences, not specified by language grammar
	var skipDescription = false;
	// array to store tags
	var tagBuffer = [];

	var docStringMarkHandler = function(){
		if(Postponer.triggered){
			Buffer.addArgument(argBuffer);
			argBuffer = [];
		}
		else Postponer.doUntil(DOC_STRING_MARK, function(){
			if(this.startsWith(MAIN_BLOCK_HEADINGS) == this.PASSED
			&& App.getConfigValue('interrupt_doc_string_on_block_annotation')){
				// breaking cycle
				Postponer.triggered = false;
				Buffer.sendError("DocString includes keyword "+quote(this.firstPart)+
					'\nSymbol """ is very likely to be mistakenly omitted.');
			}else{
				argBuffer.push(this.val);
				return false; // interrupt chain
			}
		});
	}
	var procedureHandler = function(){
		skipDescription = true;
		checkVariables = true;

		var last = this.lastPart;
		var withPos = last.indexOf('With')
		if(withPos != -1){
			var name = trim(last.substr(0, withPos));
			var args = last.substr(withPos+'With'.length).split(',');
			Buffer.newBlock(this, name, args.map(trim));
		}else{
			Buffer.newBlock(this, last);
		}
	};
	var stepHandler = function(){
		skipDescription = false;

		var last = this.lastPart;
		if(checkVariables){
			// TODO think of better name, this is incorrect
			var splited = [];
			var varPos = last.search(/<(\w+)>/);
			var varEnd = -1; //if no variables are found, substr(varEnd+1) will be a whole line'
			while(varPos >= 0){
				varEnd = last.indexOf('>',varPos);
				splited.push(last.substring(0, varPos)); // not including '>'
				splited.push(last.substring(varPos+1,varEnd));
				// WSH String.search doesn't support search from selected position
				last = last.substr(varEnd+1);
				varPos = last.search(/<(\w+)>/);
			}
			splited.push(last);
			Buffer.load(this, splited);
		}else{
			Buffer.load(this, [last]);
		}
	}

	return{
		finish: function(){
			debug('Syntax.finish()');
			if(Postponer.awaited(DOC_STRING_MARK)){
				Buffer.sendError("Doc string haven't finished");
			}else if(Postponer.triggered){
				// call waited for negative actions
				Postponer.act.call(new GherkinLine(""));
			}else if(skipDescription){
				Buffer.sendError("Expected test steps, but found end of file");
			}
			Buffer.finish();
		},
		parse: function(nextLine){
			var line = trim(nextLine);
			// alert('Line '+line);
			new GherkinLine(line)
			.chain(line.length == 0).startsWith('#')/*comment*/
			// check condition of postponed action and probably call it 
			.chain(Postponer.triggered, Postponer.act)
			.startsWith(DOC_STRING_MARK, docStringMarkHandler)
			// tag
			.startsWith('@', function(){
				// check "flying" tag list without following scenario
				Postponer.callIfNot(SCENARIO_HEADINGS, EXAMPLES_ANNOTATION, function(){
					Buffer.sendError("Unexpected position of tags "+tagBuffer.join());
					tagBuffer = [];
				});
				// TEMPORARY
				tagBuffer.push(this.val.split(',').apply(trim).filter(function(str){
					return str.charAt(0) == '@';
				}));
			})
			// table row
			.startsWith('|', function(){
				// if table load just started, set table end handler
				if( !Postponer.awaited('|')){
					Postponer.waitWhile('|', function(){
						Buffer.addArgument(argBuffer);
						argBuffer = [];
					});
				}
				argBuffer.push(line.split('|').apply(trim).filter(function(str){
					return str.length > 0;
				}));
				debug("Read last table row: "+argBuffer.last());
			})
			.startsWith('"', function(){
				if(line.last() == '"') Buffer.addArgument(line);
				else Buffer.sendError("Unexpected position of quote in "+line);
			})
			.startsWith(EXAMPLES_ANNOTATION, function(){
				// check end of DataTable after keyword Examples
				// TODO check positive number of rows with argBuffer.length
				Postponer.waitWhile('|', function(){
					Buffer.addExamples(argBuffer,tagBuffer);
					argBuffer = [];
					tagBuffer = [];
				});
			})
			.startsWith(FEATURE_ANNOTATION, AFTERWARD_ANNOTATIONS,BACKGROUND_ANNOTATION,FINALLY_ANNOTATION, function(){
				skipDescription = true;
				Buffer.newBlock(this);
			})
			.startsWith(PROCEDURE_ANNOTATION, procedureHandler)
			.startsWith(SCENARIO_HEADINGS, function(){
				skipDescription = true;
				var tags = (tagBuffer.length) ? tagBuffer : undefined;
				checkVariables = (this.firstPart == OUTLINE_ANNOTATION);
				Buffer.newBlock(this, trim(this.lastPart), tags);
				tagBuffer = [];
			})
			.startsWith(STEP_KEYWORDS, stepHandler)
			.chain(skipDescription).other(function(){
				Buffer.sendError("Unexpected line "+quote(this.val));
			});
		},
		start: function(){
			Postponer.callIfNot(FEATURE_ANNOTATION, function(){
				// alert(this.val);
				Buffer.sendError("File should start with feature");
			});
		}
	};
})();