#omitted, because file doesn't start with feature
Scenario: test
	When step
 
Feature: runtime tests
	Scenario: undefined step
		When undefined step
		And step
		Then print
			"Undefined When step is expected to interrupt scenario"
	 
	GivenProcedure: print_A
		When print
			"A"
	#test name conflict reaction
	GivenProcedure: print_A
		When print
			"B"
	#scenario should call the first one
	Scenario: print 'A'
		When print_A