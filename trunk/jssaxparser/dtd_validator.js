/*global SAXParseException, AnyName, Attribute, AttributeNode, Choice, Context, DatatypeLibrary, Element, ElementNode, Empty, Group, Name, NotAllowed, OneOrMore, QName, SAXException, Text, TextNode, ValidatorFunctions */
/*
Copyright or © or Copr. Nicolas Debeissat, Brett Zamir

nicolas.debeissat@gmail.com (http://debeissat.nicolas.free.fr/) brettz9@yahoo.com

This software is a computer program whose purpose is to parse XML
files respecting SAX2 specifications.

This software is governed by the CeCILL license under French law and
abiding by the rules of distribution of free software. You can use,
modify and/ or redistribute the software under the terms of the CeCILL
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info".

As a counterpart to the access to the source code and rights to copy,
modify and redistribute granted by the license, users are provided only
with a limited warranty and the software's author, the holder of the
economic rights, and the successive licensors have only limited
liability.

In this respect, the user's attention is drawn to the risks associated
with loading, using, modifying and/or developing or reproducing the
software by the user in light of its specific status of free software,
that may mean that it is complicated to manipulate, and that also
therefore means that it is reserved for developers and experienced
professionals having in-depth computer knowledge. Users are therefore
encouraged to load and test the software's suitability as regards their
requirements in conditions enabling the security of their systems and/or
data to be ensured and, more generally, to use and operate it in the
same conditions as regards security.

The fact that you are presently reading this means that you have had
knowledge of the CeCILL license and that you accept its terms.

*/

(function () { // Begin namespace

// http://www.saxproject.org/apidoc/org/xml/sax/helpers/DefaultHandler.html
function DtdValidator () {
    this.saxParseExceptions = [];
    this.elements = {};
}
// INTERFACE: ContentHandler: http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
DtdValidator.prototype.startDocument = function() {
};

DtdValidator.prototype.startElement = function(namespaceURI, localName, qName, atts) {
    var attributeNodes = [];
    for (var i = 0 ; i < atts.getLength() ; i++) {
        attributeNodes.push(new AttributeNode(new QName(atts.getURI(i), atts.getLocalName(i)), atts.getValue(i)));
    }
    var newElement = new ElementNode(new QName(namespaceURI, localName), this.instanceContext, attributeNodes, []);
    //this.childNode must be an ElementNode
    if (!this.childNode) {
        this.childNode = this.currentElementNode = newElement;
    } else {
        this.currentElementNode.childNodes.push(newElement);
        newElement.setParentNode(this.currentElementNode);
        this.currentElementNode = newElement;
    }
};

DtdValidator.prototype.endElement = function(namespaceURI, localName, qName) {
    if (this.currentElementNode.parentNode) {
        this.currentElementNode = this.currentElementNode.parentNode;
    }
};

DtdValidator.prototype.startPrefixMapping = function(prefix, uri) {
};

DtdValidator.prototype.endPrefixMapping = function(prefix) {
};

DtdValidator.prototype.processingInstruction = function(target, data) {
};

DtdValidator.prototype.ignorableWhitespace = function(ch, start, length) {
};

DtdValidator.prototype.characters = function(ch, start, length) {
    var newText = new TextNode(ch);
    this.currentElementNode.childNodes.push(newText);
};

DtdValidator.prototype.skippedEntity = function(name) {
};

DtdValidator.prototype.endDocument = function() {
    //if a dtd is present
    if (this.pattern) {
        var datatypeLibrary = new DatatypeLibrary();
        this.debug = false;
        this.validatorFunctions = new ValidatorFunctions(this, datatypeLibrary);
        this.resultPattern = this.validatorFunctions.childDeriv(this.context, this.pattern, this.childNode);
        if (this.resultPattern instanceof NotAllowed) {
            throw new SAXException("document not valid, message is : [" + this.resultPattern.message + "], expected was : [" + this.resultPattern.pattern.toHTML() + "], found is : [" + this.resultPattern.childNode.toHTML() + "]");
        }
    }
};

DtdValidator.prototype.setDocumentLocator = function (locator) {
};

// INTERFACE: DTDHandler: http://www.saxproject.org/apidoc/org/xml/sax/DTDHandler.html
DtdValidator.prototype.notationDecl = function (name, publicId, systemId) {
};
DtdValidator.prototype.unparsedEntityDecl = function (name, publicId, systemId, notationName) {
};

// INTERFACE: ErrorHandler: http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
DtdValidator.prototype.warning = function(saxParseException) {
    this.saxParseExceptions.push(saxParseException);
};
DtdValidator.prototype.error = function(saxParseException) {
    this.saxParseExceptions.push(saxParseException);
};
DtdValidator.prototype.fatalError = function(saxParseException) {
    throw saxParseException;
};


// INTERFACE: DeclHandler: http://www.saxproject.org/apidoc/org/xml/sax/ext/DeclHandler.html

DtdValidator.prototype.attributeDecl = function(eName, aName, type, mode, value) {
    //adds the attribute as the first member of a group with old pattern as the second member
    var elementPattern = this.elements[eName];
    var attributePattern = new Attribute(aName, type);
    var group = new Group(attributePattern, elementPattern.pattern);
    elementPattern.pattern = group;
};

/*
[45]   	elementdecl	   ::=   	'<!ELEMENT' S  Name  S  contentspec  S? '>'	[VC: Unique Element Type Declaration]
[46]   	contentspec	   ::=   	'EMPTY' | 'ANY' | Mixed | children 
[51]    	Mixed	   ::=   	'(' S? '#PCDATA' (S? '|' S? Name)* S? ')*'
			| '(' S? '#PCDATA' S? ')'
*/
DtdValidator.prototype.getPatternFromModel = function(model) {
    if (model === "'EMPTY'") {
        return new Empty();
    } else if (model === "'ANY'") {
        return new Choice(new Empty(), new OneOrMore(new Element(new AnyName(), new Text())));
    } else {
        var returned;
        if (/^\( ?#PCDATA/.test(model)) {
            returned = this.getPatternFromMixed(model);
        } else {
            returned = this.getPatternFromChildren(model);
        }
        return returned;
    }
};

/*
[51]    	Mixed	   ::=   	'(' S? '#PCDATA' (S? '|' S? Name)* S? ')*'
			| '(' S? '#PCDATA' S? ')'
*/
DtdValidator.prototype.getPatternFromMixed = function(model) {
    var textNode = new Text();
    var returned;
    // if other elements
    var splitOr = model.split("|");
    //from the last to the second
    for (var i = splitOr.length - 1 ; i > 0 ; i--) {
        //trim whitespaces
        var name = splitOr[i].replace(/^ ?/, "").replace(/ ?$/, "");
        if (!this.elements[name]) {
            this.elements[name] = new Element(new Name(null, name));
        }
        if (returned) {
            returned = new Group(this.elements[name], returned);
        } else {
            returned = this.elements[name];
        }
    }
    if (!returned) {
        return textNode;
    }
    return new Group(textNode, returned);
};

/*
[47]   	children	   ::=   	(choice | seq) ('?' | '*' | '+')?
[48]   	cp	   ::=   	(Name | choice | seq) ('?' | '*' | '+')?
[49]   	choice	   ::=   	'(' S? cp ( S? '|' S? cp )+ S? ')'
[50]   	seq	   ::=   	'(' S? cp ( S? ',' S? cp )* S? ')'
*/
DtdValidator.prototype.getPatternFromChildren = function(model) {
    var parsedModel = /^( ?\()* ?(\w+)([*+?])? ?[,)](.*)$/.exec(model);
    //["PRODUCT*)", undefined, "PRODUCT", "*", ""]
    // if there is a Name
    var name = parsedModel[2];
    if (!this.elements[name]) {
        this.elements[name] = new Element(new Name(null, name));
    }
    var pattern1;
    var operator = parsedModel[3];
    switch (operator) {
        case "?":
            pattern1 = new Choice(this.elements[name], new Empty());
            break;
        case "+":
            pattern1 = new OneOrMore(this.elements[name]);
            break;
        case "*":
            pattern1 = new Choice(new Empty(), new OneOrMore(this.elements[name]));
            break;
        //in case there is no operator, undefined
        default:
            pattern1 = this.elements[name];
            break;
    }
    var restOfModel = parsedModel[4];
    if (restOfModel) {
        var pattern2 = this.getPatternFromChildren(restOfModel);
    }
    if (pattern2) {
        return new Group(pattern1, pattern2);
    } else {
        return pattern1;
    }
};

DtdValidator.prototype.elementDecl = function(name, model) {
    var pattern = this.getPatternFromModel(model);
    if (!this.elements[name]) {
        this.elements[name] = new Element(new Name(null, name), pattern);
    } else {
        this.elements[name].pattern = pattern;
    }
};

DtdValidator.prototype.externalEntityDecl = function(name, publicId, systemId) {
};

DtdValidator.prototype.internalEntityDecl = function(name, value) {
};

// INTERFACE: LexicalHandler: http://www.saxproject.org/apidoc/org/xml/sax/ext/LexicalHandler.html

DtdValidator.prototype.comment = function(ch, start, length) {
};

DtdValidator.prototype.endCDATA = function() {
};

DtdValidator.prototype.endDTD = function() {
};

DtdValidator.prototype.endEntity = function(name) {
};

DtdValidator.prototype.startCDATA = function() {
};

DtdValidator.prototype.startDTD = function(name, publicId, systemId) {
    this.pattern = this.elements[name] = new Element(new Name(null, name));
    this.context = new Context(publicId, []);
};

DtdValidator.prototype.startEntity = function(name) {
};
// INTERFACE: EntityResolver: http://www.saxproject.org/apidoc/org/xml/sax/EntityResolver.html
// Could implement this by checking for last two arguments missing in EntityResolver2 resolveEntity() below
// DefaultHandler2.prototype.resolveEntity = function (publicId, systemId) {};
// INTERFACE: EntityResolver2: http://www.saxproject.org/apidoc/org/xml/sax/ext/EntityResolver2.html
DtdValidator.prototype.resolveEntity = function(name, publicId, baseURI, systemId) {
    return null;
};
DtdValidator.prototype.getExternalSubset = function(name, baseURI) {
};


// Could put on org.xml.sax.ext.
this.DtdValidator = DtdValidator;

}()); // end namespace