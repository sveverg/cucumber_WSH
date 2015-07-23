# tests output for different types of syntax errors
 
Scenario: doubtful keyword
	And print 
		"12345"
 
Scenario: orphanic argument
	"abcdabcd"
	When print
		"Next step should be ignored"
Finally:
	When print
		"Finally also should be ignored"
 
Scenario Outline: bug "params.length is null or not object"
	When print 
		<message>
Examples:
| num | message |
| 1   | "1234"  |
| 2   | 5678    |

