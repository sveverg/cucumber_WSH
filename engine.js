var Engine = (function(){
	// second argument for Core.runBlock()
	var CRITICAL = true;
	var ENGINE_DEBUG = true;

	var blocks = [];

	var SCENARIO = 0;
	// If procedure can't be loaded to blocks[name], ex. name is duplicated
	// then it's loaded to blocks[CARANTINE]
	// to avoid long list of errors "Engine: sentence 'step' is loaded to an undefined procedure"
	// It exists for some time, but can't be called
	var CARANTINE = 1;
	// This cell is used to store Finally blocks
	// It can be pointed by loadedBlock in appendToLoading()
	// or accessed directly in run()
	var FINALLY = 2;
	var BACKGROUND = 3;
	var AFTERWARD = 4;

	var loadedBlock;

	var State = {
		EXECUTE_ALL: 10,
		LOAD_BLOCK: 11,
		SKIP_BLOCK: 12,
		SKIP_FINALLY: 13,
		SKIP_FEATURE: 14
	}
	var state = State.LOAD_BLOCK;

	var currentKeyword;

	var debug = function(msg){
		if(ENGINE_DEBUG && App.debug) alert('Engine: '+msg);
	}

	var executeBlock = function(blockKey, critical){
		// block error reset
		if(state <= State.SKIP_BLOCK) state = State.EXECUTE_ALL;
		currentKeyword = undefined;
		Core.runBlock(blocks[blockKey], critical === CRITICAL);
	}

	var isNotProcedure = function(loadedBlock){
		return loadedBlock == blocks[SCENARIO] || loadedBlock == blocks[FINALLY];
	}

	var loadError = function(msg, procedure){
		Log.print('Load error: '+msg);
		if(procedure){
			procedure.invalid = true;
			Log.print('Happened in procedure '+quote(procedure.name));
		} 
		Log.print();
	}

	var runtimeError = function(errorName, msg, dataObject, critical){
		debug('Runtime error called');
		if(critical){
			debug('SKIP_FEATURE');
			state = State.SKIP_FEATURE;
		}else if(!currentKeyword || currentKeyword == 'Given'){
			state = State.SKIP_FINALLY;
		}else{
			state = State.SKIP_BLOCK;
		}
		Log.addError(errorName, msg, dataObject, critical);
	}

	var runOutline = function(examples, hasFinally){
		debug('runOutline');
		// used to call finally after each examples row
		// and avoid outline interruption after first error occurred
		var cycleCallback = function(){
			if(hasFinally && state < State.SKIP_FINALLY){
				executeBlock(FINALLY, CRITICAL);
			}
			if(state < State.SKIP_FEATURE){
				// block information reset
				state = State.EXECUTE_ALL;
				currentKeyword = undefined;
			}
			//whether outline execution should be continued
			return state < State.SKIP_FEATURE; 
		}
		if(state < State.SKIP_FEATURE){
			if(blocks[BACKGROUND]){
				executeBlock(BACKGROUND, CRITICAL);
			}
			// if no errors in Background
			if(state < State.SKIP_BLOCK){
				state = State.EXECUTE_ALL;
				currentKeyword = undefined;
				// cycleCallback is executed after every row of examples
				Core.runCycle(blocks[SCENARIO], examples, false, cycleCallback);
			}
			if(blocks[AFTERWARD]){
				executeBlock(AFTERWARD, CRITICAL);
			}
		}
		else debug('Outline Examples skipped');
	}

	// @param {hasFinally} whether executed scenario has block Finally
	var runScenario = function(hasFinally){
		debug('SCENARIO');
		debug('state='+state);
		// if scenario execution is allowed by Flow
		if(state < State.SKIP_FEATURE){
			if(blocks[BACKGROUND]){
				executeBlock(BACKGROUND, CRITICAL);
			}
			//no errors in Background
			if(state < State.SKIP_BLOCK){
				executeBlock(SCENARIO);
				if(hasFinally && state < State.SKIP_FINALLY){
					executeBlock(FINALLY, CRITICAL);
				}
			}
			debug('state='+state);
			//if Background was called, Afterward is called in any case
			if(blocks[AFTERWARD]){
				executeBlock(AFTERWARD, CRITICAL);
			}
		}
		else debug('Scenario skipped');
	}

	return {
		addAfterward: function(){
			if(!loadedBlock || loadedBlock == blocks[BACKGROUND]){
				blocks[AFTERWARD] = {name: 'Afterward block', steps: []};
				loadedBlock = blocks[AFTERWARD];
				state = State.LOAD_BLOCK;
			}
			else loadError('Block Afterward can be preceded only by Background block');
			// TODO add to CARANTINE
		},
		addBackground: function(){
			if(!loadedBlock){
				blocks[BACKGROUND] = {name: 'Background block', steps: []};
				loadedBlock = blocks[BACKGROUND];
				state = State.LOAD_BLOCK;
			}
			else loadError('No block can precede block Background');
		},
		addFinallyBlock: function(){
			if(loadedBlock == blocks[SCENARIO] || loadedBlock == blocks[CARANTINE]){
				blocks[FINALLY] = {
					name: 'Finally block',
					steps: []
				};
				loadedBlock = blocks[FINALLY];
			}
			else if(loadedBlock == blocks[FINALLY]){
			     loadError("Second block Finally is not allowed", loadedBlock);
			}
			else loadError("Block Finally after procedure is not allowed", loadedBlock);
		},
		// appends step to loading procedure or scenario outline
		appendToLoading: function(word, step, arg){
			if(state == State.LOAD_BLOCK){
				loadedBlock.steps.push({
					word: word,
					step: step,
					arg: arg
				});
			}else if(state == State.EXECUTE_ALL){
				// TODO add array support to Log
				Engine.runtimeError(
					"syntax error",
					"Unexpected step ".concat(quote(word,' ',step)," after Examples block")
				);
			}
		},
		//TEMPORARY everything will be loadError()
		catchSyntaxError: function(msg){
			if(state == State.LOAD_BLOCK && loadedBlock != blocks[SCENARIO]){
				loadError(msg, loadedBlock);
			}
			else runtimeError('syntax error', msg);
		},
		finishLoad: function(){
			if(loadedBlock && isNotProcedure(loadedBlock)){
				// if scenario was no times executed, but also wasn't aborted 
				// TODO needs improvement, outline without examples is not handled properly
				if(state == State.LOAD_BLOCK){
					// suggest, it's not scenario outline, and execute it
					runScenario(/*hasFinally*/ loadedBlock == blocks[FINALLY]);
				}
				Log.printReport();
			}
		},
		getProcedure: function(name){
			//TODO defense against numeric steps 
			return blocks[name];
		},
		// TODO defense against numeric procedure names
		newProcedure: function(name, params){
			debug("Loading Procedure "+name);
			state = State.LOAD_BLOCK;
			var procName = name;
			if(blocks[name]){
				loadError("there is another procedure with name "+name);
				procName = CARANTINE;
			} 
			blocks[procName] = {name: name, params: params, steps: []};
			loadedBlock = blocks[procName];
		},
		newScenario: function(name, tags){
			// if(Flow.allowsScenario(name, tags)){
			debug('state='+state);
			if(state < State.SKIP_FEATURE){
				state = State.LOAD_BLOCK;
				Log.recordScenario(name, tags);
				blocks[SCENARIO] = {name: name, steps: []};
				loadedBlock = blocks[SCENARIO];
			}else{
				// for proper reports about syntax errors
				blocks[CARANTINE] = {name: name, steps: []};
				loadedBlock = blocks[CARANTINE];
				// state is still SKIP_FEATURE, so steps are not recorded
				debug('Scenario '+quote(name)+'is omitted');
			}
		},
		// runs loaded outline with following examples table
		runOutline: function(examples, exampleTags){
			debug('runOutline');
			if(isNotProcedure(loadedBlock)){
				// place to check tags
				runOutline(examples, /*hasFinally*/loadedBlock == blocks[FINALLY]);
			}
			else loadError("Procedure can't be executed with Examples", loadedBlock);
		},
		runtimeError: runtimeError,
		setCurrentKeyword: function(keyword){
			currentKeyword = keyword;
		}
	}
})();

