var displayedList = [];
var list = [];
var selectedBook = undefined;
var targetFormat = undefined;

Given(/^following book list$/, function(bookArr){
	list = [];
	bookArr.foreach(function(bookData){
		list.push({
			name: bookData[0],
			ext: bookData[1]
		});
	});
});
When(/^filter by format "(.+)"$/,function(format){
	displayedList = list.filter(function(book){
		return book.ext == format;
	});
});
When(/^focus "(.+)" with name "(.+)"$/,function(){});
When(/^open window "(.+)"$/,function(){});
When(/^press "Start"$/,function(){
	selectedBook.ext = targetFormat;
});
When(/^select format (.+)$/,function(format){
	targetFormat = format;
});
When(/^select book (.+)$/, function(name){
	list.some(function(book){
		if(book.name == name){
			selectedBook = book;
			return true;
		}
	});
});
Then(/^book extension should be (.+)$/, function(extension){
	return selectedBook.ext == extension;
})
Then(/^list length should be (\d+)$/, function(length){
	// alert('real length '+displayedList.length);
	// alert('length '+length);
	// alert(' '+(displayedList.length == length));
	return displayedList.length+'' == length;
});

