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
				Engine.newFeature(trim(gLine.lastPart));
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

var Syntax = (function(){
	// will be in configuration file
	var INTERRUPT_DOC_STRING_ON_SCENARIO = true;

	//------- LIST OF PARSER STATES -------
	
	// started after reading tags
	// expects next line to be scenario, else throws error
	// after that finished
	var EXPECTING_SCENARIO = 1;

	// started after finding first table element
	// puts table rows as arrays into argBuffer
	// finished after finding line, that's not table row
	// sends accumulated table to the Buffer.addArgument
	var READING_DATA_TABLE = 2;

	// started after scenarios, features and procedures
	// skips sentences, which don't belong to syntax constructions of the language
	// finished after finding first syntax construction except #comment
	var READING_DESCRIPTION = 3;

	// started after finding """ block
	// puts everything except """ into argBuffer
	// finished after finding other """
	var READING_DOC_STRING = 4;

	// started after finding keyword Examples
	// behaves and stops like READING_DATA_TABLE
	// sends accumulated table and Example tags to the Buffer.addExamples
	var READING_EXAMPLES = 5;

	// state of expecting every syntax construction, but nothing else
	var STANDARD = 6;

	//----------------------------------

	// array to store DocStrings and DataTables
	var argBuffer = [];

	// whether program checks existence of <variables> in the line
	var expectVariables = false;

	// current state of the syntax parser
	var state = STANDARD;

	// array to store tags
	var tagBuffer = [];

	var printState = function(state){
		switch(state){
			case EXPECTING_SCENARIO: alert('expecting scenario');
				break;
			case READING_DATA_TABLE: alert('reading DataTable');
				break;
			case READING_DESCRIPTION:alert('reading description');
				break;
			case READING_DOC_STRING: alert('reading DocString');
				break;
			case READING_EXAMPLES: alert('reading Examples');
				break;
			case STANDARD: alert('standard');
				break;
			default: alert('Error');
		}
	}

	// Function is executed before analyzing meaningful cases,
	// is parser state is not STANDARD or READING_DESCRIPTION.
	// It returns true, if current line parsing should be interrupted.
	var handleSpecialStates = function(){
		switch(state){
			case EXPECTING_SCENARIO: 
				// check "flying" tag list without following scenario
				if(this.startsWith(SCENARIO_HEADINGS, EXAMPLES_ANNOTATION) != this.PASSED){
					Buffer.sendError("Unexpected position of tags "+tagBuffer.join());
					tagBuffer = [];
					state = STANDARD;
				}
			break;
			case READING_DATA_TABLE:
				// check end of DataTable(it's not marked anyhow)
				if( this.startsWith('|') != this.PASSED){
					Buffer.addArgument(argBuffer);
					argBuffer = [];
				}
			break;
			case READING_DOC_STRING:
				if(this.startsWith(SCENARIO_HEADINGS, PROCEDURE_ANNOTATION) == this.PASSED
				&& INTERRUPT_DOC_STRING_ON_SCENARIO){
					Buffer.sendError("DocString includes keyword "+quote(this.firstPart)+
						'\nSymbol """ is very likely to be mistakenly omitted.')
					state = STANDARD;
				}else if(this.startsWith(DOC_STRING_MARK) != this.PASSED){
					argBuffer.push(this.val);
					return false; // interrupt chain
				}
			break;
			case READING_EXAMPLES:
				// check end of DataTable after keyword Examples
				if(this.startsWith('|') != this.PASSED){
					Buffer.addExamples(argBuffer,tagBuffer);
					argBuffer = [];
					tagBuffer = [];
					state = STANDARD;
					// debug('Examples ended');
				}
			break;
		}
		return true; // continue line parsing
	};

	var procedureHandler = function(){
		state = READING_DESCRIPTION;
		expectVariables = true;

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
		state = STANDARD;
		var last = this.lastPart;
		if(expectVariables){
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
			// alert(new GherkinLine("#5 12").startsWith('#5').content());
			// alert(GherkinLine.prototype.PASSED.content());
			// alert({a: 2, b: 7, c: function(){}}.content());
			debug('Syntax.finish()');
			if(state == READING_DATA_TABLE){
				Buffer.addArgument(argBuffer);
				argBuffer = [];
			}
			else if(state == READING_EXAMPLES){
				Buffer.addExamples(argBuffer,tagBuffer);
				argBuffer = [];
				tagBuffer = [];
				state = STANDARD;
			}
			else if(state == READING_DESCRIPTION){
				Buffer.sendError("Expected test steps, but found end of file");
			}
			else if(state == READING_DOC_STRING){
				Buffer.sendError("Doc string haven't finished");
			}
			else if(state == EXPECTING_SCENARIO){
				Buffer.sendError("Unexpected position of tags "+tagBuffer.join());
			}
			Buffer.finish();
		},
		parse: function(nextLine){
			// assert(new GherkinLine("Scenario: unexpected").startsWith(SCENARIO_HEADINGS, function(){
			// 	return true;
			// }) != new GherkinLine(34).PASSED, "startsWith doesn't work properly");

			var line = trim(nextLine);
			new GherkinLine(line).chain(line.length == 0).startsWith('#')/*comment*/
			.chain(state != STANDARD && state != READING_DESCRIPTION, handleSpecialStates)
			//
			.startsWith(DOC_STRING_MARK, function(){
				if(state == READING_DOC_STRING){ 
					Buffer.addArgument(argBuffer);
					argBuffer = [];
					state = STANDARD;
				}else state = READING_DOC_STRING;
			})
			// tag
			.startsWith('@', function(){
				state = EXPECTING_SCENARIO;
				// TEMPORARY
				tagBuffer.push(this.val.split(',').apply(trim).filter(function(str){
					return str.charAt(0) == '@';
				}));
			})
			// table row
			.startsWith('|', function(){
				if(state != READING_EXAMPLES){
					state = READING_DATA_TABLE;
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
				state = READING_EXAMPLES;
			})
			.startsWith(FEATURE_ANNOTATION, AFTERWARD_ANNOTATIONS,BACKGROUND_ANNOTATION,FINALLY_ANNOTATION, function(){
				state = READING_DESCRIPTION;
				Buffer.newBlock(this);
			})
			.startsWith(PROCEDURE_ANNOTATION, procedureHandler)
			.startsWith(SCENARIO_HEADINGS, function(){
				// debug('Starts with Scenario headings');
				state = READING_DESCRIPTION;
				var tags = (tagBuffer.length) ? tagBuffer : undefined;
				expectVariables = (this.firstPart == OUTLINE_ANNOTATION);
				Buffer.newBlock(this, trim(this.lastPart), tags);
				tagBuffer = [];
			})
			.startsWith(STEP_KEYWORDS, stepHandler)
			.chain(state == READING_DESCRIPTION).other(function(){
				Buffer.sendError("Unexpected line "+quote(this.val));
			});
		}
	};
})();