GivenProcedure: Convert books individually
  When select book <name>
  And open window "convert book"
  And focus "dropdown list" with name "Output format"
  And select format <format>
  And press "Start"
  Then book extension should be <format>
 
Scenario: check format-based filter
Given following book list
  | book  | format |
  | book1 | html   |
  | book2 | epub   |
  | book3 | fb2    |
  When filter by format "fb2"
  Then list length should be 1
 
  When Convert books individually
  |   name          | format |
  |   book1         | epub   |
  |   book2         | fb2    |
  |   book3         | epub   |
  And filter by format "epub"
  Then list length should be 2
 
GivenProcedure: Convert books individually()
  When select book <name>
  And open window "convert book"
  And focus "dropdown list" with name "Output format"
  And select format <format>
  And press "Start"
  Then book extension should be fb2
 
Scenario: failed Then in procedure
  Given following book list
  | book  | format |
  | book1 | html   |
  | book2 | epub   |
  | book3 | fb2    |
  When filter by format "fb2"
  Then list length should be 1
 
  When Convert books individually()
  |   name          | format |
  |   book1         | epub   |
  |   book2         | fb2    |
  |   book3         | epub   |
  And filter by format "epub"
  Then list length should be 2
 
Scenario: undefined procedure parameter
Given following book list
  | book  | format |
  | book1 | html   |
  | book2 | epub   |
  | book3 | fb2    |
  When filter by format "fb2"
  Then list length should be 1
 
  When Convert books individually
  |   book_name     | format |
  |   book1         | epub   |
  |   book2         | fb2    |
  |   book3         | epub   |
  And filter by format "epub"
  Then list length should be 2
 
GivenProcedure: Convert books individually(3) With name, format
  When select book <name>
  And open window "convert book"
  And focus "dropdown list" with name "Output format"
  And select format <format>
  And press "Start"
  Then book extension should be <format>
 
Scenario: redefined parameter name
Given following book list
  | book  | format |
  | book1 | html   |
  | book2 | epub   |
  | book3 | fb2    |
  When filter by format "fb2"
  Then list length should be 1
 
  When Convert books individually(3)
  |   book_name     | format |
  |   book1         | epub   |
  |   book2         | fb2    |
  |   book3         | epub   |
  And filter by format "epub"
  Then list length should be 2
