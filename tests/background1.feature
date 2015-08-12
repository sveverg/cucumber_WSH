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
 
Scenario: test3
	When print
		"Body omitted"
	And failed step
Finally: 
	When print
		"Finally omitted"
