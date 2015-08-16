Feature: #1
	Background: 
		When print 
			"Background called"
	 
	Afterward:
		When print 
			"Afterward called"
	 
	Scenario: test1
		When print
			"Body called"
		And failed step
	Finally: 
		When print
			"Finally called"
	 
	Scenario: test2
		When print
			"Body called"
		And failed step
	Finally: 
		When print
			"Finally called"
		And failed step
	 
	Scenario: omitted
		When print
			"Body omitted"
		And failed step
	Finally: 
		When print
			"Finally omitted"
 
Feature: #2
 
	Background: second Background
		When print
			"Second Background called"
 
	#and no Afterward
	Scenario: Feature interruption was reset
		When print
			"Body called"
		And print
			"Finally called"
 
	#And wrong Afterward declaration
	Afterward:
		When print 
			"Afterward called"
 
	Scenario: Afterward should not be called
		When print
			"Body called"
		And print
			"Finally called"
 
Feature: behaviour in case of Background error
	Background: 
		When print 
			"Background called"
		And failed step
	 
	Afterward:
		When print 
			"Afterward called"
	 
	Scenario: test 1
		When print
			"Body omitted"
		When failed step
	Finally: 
		When print
			"Finally omitted"
		When failed step
 
	Scenario: omitted
	For that scenario even Background should not be executed
		When print
			"Body omitted"
	Finally: 
		When print
			"Finally omitted"
 
Feature: Afterward-Finally madness
	Afterward:
		When print 
			"Afterward called"
	Finally:
		When print
			"Afterward block Finally"
	Scenario: test
		When step