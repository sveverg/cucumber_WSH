Feature: fatal error
	# remove it and got load error: Finally after procedure is not allowed
	Scenario: failed step in Finally stops feature execution
		When step
	Finally:
		When failed step
	 
	Scenario: omitted because of failed step in Finally
		When print
			"Omitted because of failed step in Finally" 