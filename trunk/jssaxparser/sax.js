/*
Copyright or © or Copr. Nicolas Debeissat Brett Zamir

nicolas.debeissat@gmail.com (http://debeissat.nicolas.free.fr/) brettz9@yahoo.com

This software is a computer program whose purpose is to parse XML
files respecting SAX2 specifications.

This software is governed by the CeCILL license under French law and
abiding by the rules of distribution of free software.  You can  use, 
modify and/ or redistribute the software under the terms of the CeCILL
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info". 

As a counterpart to the access to the source code and  rights to copy,
modify and redistribute granted by the license, users are provided only
with a limited warranty  and the software's author,  the holder of the
economic rights,  and the successive licensors  have only  limited
liability. 

In this respect, the user's attention is drawn to the risks associated
with loading,  using,  modifying and/or developing or reproducing the
software by the user in light of its specific status of free software,
that may mean  that it is complicated to manipulate,  and  that  also
therefore means  that it is reserved for developers  and  experienced
professionals having in-depth computer knowledge. Users are therefore
encouraged to load and test the software's suitability as regards their
requirements in conditions enabling the security of their systems and/or 
data to be ensured and,  more generally, to use and operate it in the 
same conditions as regards security. 

The fact that you are presently reading this means that you have had
knowledge of the CeCILL license and that you accept its terms.

*/

(function () { // Begin namespace

/* Private static variables (constant) */

/* XML Name regular expressions */
var NAME_START_CHAR = ":A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u0200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\ud800-\udb7f\udc00-\udfff"; // The last two ranges are for surrogates that comprise #x10000-#xEFFFF
var NAME_END_CHAR = ".0-9\u00B7\u0300-\u036F\u203F-\u2040-"; // Don't need escaping since to be put in a character class
var NOT_START_OR_END_CHAR = new RegExp("[^" + NAME_START_CHAR + NAME_END_CHAR + "]");

/* Scanner states  */
var STATE_XML_DECL                  =  0;
var STATE_PROLOG                    =  1;
var STATE_PROLOG_DOCTYPE_DECLARED   =  2;
var STATE_ROOT_ELEMENT              =  3;
var STATE_CONTENT                   =  4;
var STATE_TRAILING_MISC             =  5;

/* Error values */
var WARNING = "W";
var ERROR = "E";
var FATAL = "F";


// The official SAX2 parse() method is not implemented (that can either accept an InputSource object or systemId string;
//    for now the parseString() method can be used (and is more convenient than converting to an InputSource object).
// The feature/property defaults are incomplete, as they really depend on the implementation and how far we
//   implement them; however, I've added some of the defaults, two of which (on namespaces) are required to be
//   supported (though they don't need to support both true and false options).
// So,
// 1) the only meaningful methods at the moment are getContentHandler(), setContentHandler(), and our own parseString().
// 2) No property should be retrieved or set publicly.
// 3) The SAXParser constructor currently only works with the first argument

function SAXParser (contentHandler, lexicalHandler, errorHandler, declarationHandler, dtdHandler, domNode) {
    // Implements SAX2 XMLReader interface;
    // Since SAX2 doesn't specify constructors, this class is able to define its own behavior to accept a contentHandler, etc.

    this.contentHandler = contentHandler;
    this.dtdHandler = dtdHandler;
    this.errorHandler = errorHandler;
    this.entityResolver = null;

    this.disallowedGetProperty = [];
    this.disallowedGetFeature = [];
    this.disallowedSetProperty = [];
    this.disallowedSetFeature = [];

    this.disallowedSetPropertyValues = {};
    this.disallowedSetFeatureValues = {};

    // For official features and properties, see http://www.saxproject.org/apidoc/org/xml/sax/package-summary.html#package_description
    // We can define our own as well
    this.features = {}; // Boolean values
    this.features['http://xml.org/sax/features/external-general-entities'];
    this.features['http://xml.org/sax/features/external-parameter-entities'];
    this.features['http://xml.org/sax/features/is-standalone'] = undefined; // Can only be set during parsing
    this.features['http://xml.org/sax/features/lexical-handler/parameter-entities'];
    this.features['http://xml.org/sax/features/namespaces'] = true; // must support true
    this.features['http://xml.org/sax/features/namespace-prefixes'] = false; // must support false
    this.features['http://xml.org/sax/features/resolve-dtd-uris'] = true;
    this.features['http://xml.org/sax/features/string-interning'] = true; // Make safe to treat string literals as identical to String()
    this.features['http://xml.org/sax/features/unicode-normalization-checking'] = false;
    this.features['http://xml.org/sax/features/use-attributes2'];
    this.features['http://xml.org/sax/features/use-locator2'];
    this.features['http://xml.org/sax/features/use-entity-resolver2'] = true;
    this.features['http://xml.org/sax/features/validation'];
    this.features['http://xml.org/sax/features/xmlns-uris'] = false;
    this.features['http://xml.org/sax/features/xml-1.1'];

    this.properties = {}; // objects
    this.properties['http://xml.org/sax/properties/declaration-handler'] = declarationHandler || (this.declarationHandler = {
        attributeDecl : function (eName, aName, type, mode, value) { // java.lang.String, java.lang.String, java.lang.String, java.lang.String, java.lang.String
            // Report an attribute type declaration (void).
        },
        elementDecl : function (name, model) { // java.lang.String, java.lang.String
            // Report an element type declaration (void).
        },
        externalEntityDecl : function (name, publicId, systemId) { // java.lang.String, java.lang.String, java.lang.String
            // Report a parsed external entity declaration.
        },
        internalEntityDecl : function (name, value) { // java.lang.String, java.lang.String
            // Report an internal entity declaration (void).
        }
    });
    this.properties['http://xml.org/sax/properties/document-xml-version'] = this.documentXmlVersion = null;
    this.properties['http://xml.org/sax/properties/dom-node'] = this.domNode = domNode;
    this.properties['http://xml.org/sax/properties/lexical-handler'] = this.lexicalHandler = lexicalHandler || null;
    this.properties['http://xml.org/sax/properties/xml-string'] = this.xmlString = null;


    // IMPLEMENTATION-DEPENDENT PROPERTIES TO SUPPORT PARSING
    this.index = -1;

    this.state = STATE_XML_DECL;

    this.elementsStack;
    /* for each depth, a map of namespaces */
    this.namespaces;

}

// BEGIN SAX2 INTERFACE
SAXParser.prototype.getContentHandler = function () {
    // Return the current content handler (ContentHandler).
    return this.contentHandler;
};
SAXParser.prototype.getDTDHandler = function () {
    // Return the current DTD handler (DTDHandler).
    return this.dtdHandler;
};
SAXParser.prototype.getEntityResolver = function () {
    // Return the current entity resolver (EntityResolver).
    return this.entityResolver;
};
SAXParser.prototype.getErrorHandler = function () {
    // Return the current error handler (ErrorHandler).
    return this.errorHandler;
};
SAXParser.prototype.getFeature = function (name) { // (java.lang.String)
    // Look up the value of a feature flag (boolean).
    if (this.features[name] === undefined) {
      throw new SAXNotRecognizedException();
    }
    else if (this.disallowedGetFeature.indexOf(name) !== -1) {
      throw new SAXNotSupportedException();
    }
    return this.features[name];
};
SAXParser.prototype.getProperty = function (name) { // (java.lang.String)
    // Look up the value of a property (java.lang.Object).
    // It is possible for an XMLReader to recognize a property name but temporarily be unable to return its value. Some property values may be available only in specific contexts, such as before, during, or after a parse.
    if (this.properties[name] === undefined) {
      throw new SAXNotRecognizedException();
    }
    else if (this.disallowedGetProperty.indexOf(name) !== -1) {
      throw new SAXNotSupportedException();
    }
    return this.properties[name];
};
SAXParser.prototype.parse = function () { // (InputSource input OR java.lang.String systemId)
    // Parse an XML document (void). OR
    // Parse an XML document from a system identifier (URI) (void).
    // may throw java.io.IOException or SAXException
};
SAXParser.prototype.setContentHandler = function (handler) { // (ContentHandler)
    // Allow an application to register a content event handler (void).
    this.contentHandler = handler;
};
SAXParser.prototype.setDTDHandler = function (handler) { // (DTDHandler)
    // Allow an application to register a DTD event handler (void).
    this.dtdHandler = handler;
};
SAXParser.prototype.setEntityResolver = function (resolver) { // (EntityResolver)
    // Allow an application to register an entity resolver (void).
    this.entityResolver = resolver;
};
SAXParser.prototype.setErrorHandler = function (handler) { // (ErrorHandler)
    // Allow an application to register an error event handler (void).
    this.errorHandler = handler;
};
SAXParser.prototype.setFeature = function (name, value) { // (java.lang.String, boolean)
    // Set the value of a feature flag (void).
    if (this.features[name] === undefined) { // Should be defined already in some manner
        throw new SAXNotRecognizedException();
    }
    else if (
            (this.disallowedSetFeatureValues[name] !== undefined &&
                    this.disallowedSetFeatureValues[name] === value) ||
                (this.disallowedSetFeature.indexOf(name) !== -1)
            ){
        throw new SAXNotSupportedException();
    }
    this.features[name] = value;
};
SAXParser.prototype.setProperty = function (name, value) { // (java.lang.String, java.lang.Object)
    // Set the value of a property (void).
    // It is possible for an XMLReader to recognize a property name but to be unable to change the current value. Some property values may be immutable or mutable only in specific contexts, such as before, during, or after a parse.
    if (this.properties[name] === undefined) { // Should be defined already in some manner
        throw new SAXNotRecognizedException();
    }
    else if (
                (this.disallowedSetPropertyValues[name] !== undefined &&
                    this.disallowedSetPropertyValues[name] === value) ||
                (this.disallowedSetProperty.indexOf(name) !== -1)
            ){
        throw new SAXNotSupportedException();
    }
    this.properties[name] = value;
};
// END SAX2 INTERFACE


// BEGIN CUSTOM API
SAXParser.prototype.parseString = function(xml) { // We implement our own for now, but should probably call the standard parse() which requires an InputSource object (or systemId string)
    this.xml = xml;
    this.length = xml.length;
    this.index = 0;
    this.ch = this.xml.charAt(this.index);
    this.state = STATE_XML_DECL;
    this.elementsStack = [];
    this.namespaces = [];
    this.contentHandler.startDocument();
    try {
        while (this.index < this.length) {
            this.next();
        }
        throw new EndOfInputException();
    } catch(e) {
        if (e instanceof SAXException) {
            this.contentHandler.fatalError(e);
        } else if (e instanceof EndOfInputException) {
            if (this.elementsStack.length > 0) {
                this.fireError("the markup " + this.elementsStack.pop() + " has not been closed", FATAL);
            } else {
                try {
                    this.contentHandler.endDocument();
                } catch(e) {}
            }
        }
    }
};

SAXParser.prototype.next = function() {
    this.skipWhiteSpaces();
    if (this.ch == ">") {
        this.nextChar();
    } else if (this.ch == "<") {
        this.nextChar();
        this.scanLT();
    } else if (this.elementsStack.length > 0) {
        this.scanText();
    //if elementsStack is empty it is text misplaced
    } else {
        this.fireError("can not have text at root level of the XML", FATAL);
    }
};



// [1] document ::= prolog element Misc*
//
// [22] prolog ::= XMLDecl? Misc* (doctypedecl Misc*)?
// [23] XMLDecl ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
// [24] VersionInfo ::= S 'version' Eq (' VersionNum ' | " VersionNum ")
//
// The beginning of XMLDecl simplifies to:
//    '<?xml' S ...
//
// [27] Misc ::= Comment | PI |  S
// [15] Comment ::= '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'
// [16] PI ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'
// [17] PITarget ::= Name - (('X' | 'x') ('M' | 'm') ('L' | 'l'))
//
// [28] doctypedecl ::= '<!DOCTYPE' S Name (S ExternalID)? S?
//                      ('[' (markupdecl | PEReference | S)* ']' S?)? '>'
//
//White Space
// [3] S ::=(#x20 | #x9 | #xD | #xA)+
SAXParser.prototype.scanLT = function() {
    if (this.state == STATE_XML_DECL) {
        if (!this.scanXMLDeclOrTextDecl()) {
            this.state = STATE_PROLOG;
            this.scanLT();
        } else {
            //if it was a XMLDecl (only one XMLDecl is permitted)
            this.state = STATE_PROLOG;
        }
    } else if (this.state == STATE_PROLOG) {
        if (this.ch == "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                this.scanDoctypeDecl();
                this.state = STATE_PROLOG_DOCTYPE_DECLARED;
            }
        } else if (this.ch == "?") {
            this.nextChar(true);
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanLT();
        }
    } else if (this.state == STATE_PROLOG_DOCTYPE_DECLARED) {
        if (this.ch == "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                this.fireError("can not have two doctype declaration", FATAL);
            }
        } else if (this.ch == "?") {
            this.nextChar(true);
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanLT();
        }
    } else if (this.state == STATE_ROOT_ELEMENT) {
        if (this.scanMarkup()) {
            this.state = STATE_CONTENT;
        } else {
            this.state = STATE_TRAILING_MISC;
        }
    } else if (this.state == STATE_CONTENT) {
        if (this.ch == "!") {
            this.nextChar();
            if (!this.scanComment()) {
                if (!this.scanCData()) {
                    this.fireError("neither comment nor CDATA after &lt;!", FATAL);
                }
            }
        } else if (this.ch == "?") {
            this.nextChar();
            this.scanPI();
        } else if (this.ch == "/") {
            this.nextChar();
            if (this.scanEndingTag()) {
                if (this.elementsStack.length == 0) {
                    this.state = STATE_TRAILING_MISC;
                }
            }
        } else {
            if (!this.scanMarkup()) {
                this.fireError("not a valid markup", FATAL);
            }
        }
    } else if (this.state == STATE_TRAILING_MISC) {
        if (this.ch == "!") {
            this.nextChar();
            if (!this.scanComment()) {
                this.fireError("end of document, only comment or processing instruction are allowed", FATAL);
            }
        } else if (this.ch == "?") {
            this.nextChar();
            if (!this.scanPI()) {
                this.fireError("end of document, only comment or processing instruction are allowed", FATAL);
            }
        }
    }
};


// 14]   	CharData ::= [^<&]* - ([^<&]* ']]>' [^<&]*)
//  what I understand from there : http://www.w3.org/TR/REC-xml/#dt-chardata is that & is allowed
// in character data only if it is an entity reference
SAXParser.prototype.scanText = function() {
    var start = this.index;
    var content = this.nextRegExp(/[<&]/);
    
    //if found a "&"
    while (this.ch == "&") {
        this.nextChar();
        var ref = this.scanRef();
        content += ref;
        content += this.nextRegExp(/[<&]/);
    }
    var length = this.index - start;
    this.contentHandler.characters(content, start, length);
};


//current char is after '&'
SAXParser.prototype.scanRef = function() {
    if (this.ch == "#") {
        this.nextChar(true);
        return this.scanCharRef();
    } else {
        return this.scanEntityRef();
    }
};


// [15] Comment ::= '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'
SAXParser.prototype.scanComment = function() {
    if (this.ch == "-") {
        this.nextChar(true);
        if (this.ch == "-") {
            //do not skip white space at beginning of comment
            this.nextChar(true);
            var start = this.index;
            var comment = this.nextRegExp(/--/);
            var length = this.index - start;
            //goes to second '-'
            this.nextChar(true);
            this.nextChar(true);
            //must be '>'
            if (this.ch == ">") {
                if (this.lexicalHandler) {
                    this.lexicalHandler.comment(comment, start, length);// Brett (test for support and change start/length?)
                }
                this.nextChar(true);
                return true;
            } else {
                this.fireError("end of comment not valid, must be --&gt;", FATAL);
            }
        } else {
            this.fireError("beginning comment markup is invalid, must be &lt;!--", FATAL);
        }
    } else {
        // can be a doctype
        return false;
    }
};


// [23] XMLDecl ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
// [24] VersionInfo ::= S 'version' Eq (' VersionNum ' | " VersionNum ")
// [80] EncodingDecl ::= S 'encoding' Eq ('"' EncName '"' |  "'" EncName "'" )
// [81] EncName ::= [A-Za-z] ([A-Za-z0-9._] | '-')*
// [32] SDDecl ::= S 'standalone' Eq (("'" ('yes' | 'no') "'")
//                 | ('"' ('yes' | 'no') '"'))
//
// [77] TextDecl ::= '<?xml' VersionInfo? EncodingDecl S? '?>'
SAXParser.prototype.scanXMLDeclOrTextDecl = function() {
    if (this.xml.substr(this.index, 5) == "?xml ") {
        this.nextGT();
        return true;
    } else {
        return false;
    }
};


// [16] PI ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'
// [17] PITarget ::= Name - (('X' | 'x') ('M' | 'm') ('L' | 'l'))
SAXParser.prototype.scanPI = function() {
    this.contentHandler.processingInstruction(this.nextName(), "");
    this.nextGT();
    return true;
};


//[28]   	doctypedecl	   ::=   	'<!DOCTYPE' S  Name (S  ExternalID)? S? ('[' intSubset ']' S?)? '>'
//[28a]   	DeclSep	   ::=   	 PEReference | S
//[28b]   	intSubset	   ::=   	(markupdecl | DeclSep)*
//[29]   	markupdecl	   ::=   	elementdecl | AttlistDecl | EntityDecl | NotationDecl | PI | Comment 
//[75]   	ExternalID	   ::=   	'SYSTEM' S  SystemLiteral
//			| 'PUBLIC' S PubidLiteral S SystemLiteral 
SAXParser.prototype.scanDoctypeDecl = function() {
    if (this.xml.substr(this.index, 7) == "DOCTYPE") {
        this.index += 7;
        this.ch = this.xml.charAt(this.index);
        this.nextChar();
        var name = this.nextRegExp(/[ \[>]/);
        if (this.ch == " ") {
            this.nextChar();
            //if there is an externalId
            if (this.xml.substr(this.index, 6) == "SYSTEM") {
                this.index += 6;
                this.ch = this.xml.charAt(this.index);
                this.nextChar();
                var systemLiteral = this.nextRegExp(/[ \[>]/);
            } else if (this.xml.substr(this.index, 6) == "PUBLIC") {
                this.index += 6;
                this.ch = this.xml.charAt(this.index);
                this.nextChar();
                var pubidLiteral = this.nextRegExp(/ /);
                this.nextChar();
                var systemLiteral = this.nextRegExp(/[ \[>]/);
            }
            if (this.ch == " ") {
                this.nextChar();
            }
        }
        if (this.ch == "[") {
            this.nextChar();
            var intSubset = this.nextRegExp(/\]/);
            this.nextChar();
        }
        if (this.ch != ">") {
            this.fireError("invalid content in doctype declaration", FATAL);
        }
    } else {
        this.fireError("invalid doctype declaration, must be &lt;!DOCTYPE", FATAL);
    }
};


// [39] element ::= EmptyElemTag | STag content ETag
// [44] EmptyElemTag ::= '<' Name (S Attribute)* S? '/>'
// [40] STag ::= '<' Name (S Attribute)* S? '>'
// [41] Attribute ::= Name Eq AttValue
// [10] AttValue ::= '"' ([^<&"] | Reference)* '"' | "'" ([^<&'] | Reference)* "'"
// [67] Reference ::= EntityRef | CharRef
// [68] EntityRef ::= '&' Name ';'
// [66] CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
// [43] content ::= (element | CharData | Reference | CDSect | PI | Comment)*
// [42] ETag ::= '</' Name S? '>'
//[4]  NameChar ::= Letter | Digit | '.' | '-' | '_' | ':' | CombiningChar | Extender
//[5]  Name ::= Letter | '_' | ':') (NameChar)*
SAXParser.prototype.scanMarkup = function() {
    var qName = this.getQName();
    this.elementsStack.push(qName.qName);
    this.scanElement(qName);
    return true;
};

SAXParser.prototype.getQName = function() {
    var name = this.nextName();
    var prefix = "";
    var localName = name;
    if (name.indexOf(":") != -1) {
        var splitResult = name.split(":");
        prefix = splitResult[0];
        localName = splitResult[1];
    }
    return new Sax_QName(prefix, localName);
};

SAXParser.prototype.scanElement = function(qName) {
    var namespacesDeclared = new Array();
    var atts = this.scanAttributes(namespacesDeclared);
    this.namespaces.push(namespacesDeclared);
    var namespaceURI = this.getNamespaceURI(qName.prefix);
    this.contentHandler.startElement(namespaceURI, qName.localName, qName.qName, atts);
    this.skipWhiteSpaces();
    if (this.ch == "/") {
        this.nextChar(true);
        if (this.ch == ">") {
            this.elementsStack.pop();
            this.endMarkup(namespaceURI, qName);
        } else {
            this.fireError("invalid empty markup, must finish with /&gt;", FATAL);
        }
    }
};

SAXParser.prototype.getNamespaceURI = function(prefix) {
    for (var i in this.namespaces) {
        var namespaceURI = this.namespaces[i][prefix];
        if (namespaceURI) {
            return namespaceURI;
        }
    }
    if (prefix == "") {
        return "";
    }
    this.fireError("prefix " + prefix + " not known in namespaces map", FATAL);
};

SAXParser.prototype.scanAttributes = function(namespacesDeclared) {
    var atts = new Array();
    this.scanAttribute(atts, namespacesDeclared);
    return new Sax_Attributes(atts);
};

SAXParser.prototype.scanAttribute = function(atts, namespacesDeclared) {
    this.skipWhiteSpaces();
    if (this.ch != ">" && this.ch != "/") {
        var attQName = this.getQName();
        this.skipWhiteSpaces();
        if (this.ch == "=") {
            this.nextChar();
            // xmlns:bch="http://benchmark"
            if (attQName.prefix == "xmlns") {
                namespacesDeclared[attQName.localName] = this.scanAttValue();
                this.contentHandler.startPrefixMapping(attQName.localName, namespacesDeclared[attQName.localName]);
            } else if (attQName.qName == "xmlns") {
                namespacesDeclared[""] = this.scanAttValue();
                this.contentHandler.startPrefixMapping("", namespacesDeclared[""]);
            } else {
                var namespaceURI = this.getNamespaceURI(attQName.prefix);
                var value = this.scanAttValue();
                var att = new Sax_Attribute(attQName, namespaceURI, value);
                atts.push(att);
            }
            this.scanAttribute(atts, namespacesDeclared);
        } else {
            this.fireError("invalid attribute, must contain = between name and value", FATAL);
        }
    }
};

// [10] AttValue ::= '"' ([^<&"] | Reference)* '"' | "'" ([^<&'] | Reference)* "'"
SAXParser.prototype.scanAttValue = function() {
    if (this.ch == '"' || this.ch == "'") {
        try {
            var attValue = this.quoteContent();
        //adding a message in that case
        } catch(e) {
            if (e instanceof EndOfInputException) {
                this.fireError("document incomplete, attribute value declaration must end with a quote", FATAL);
            } else {
                throw e;
            }
        }
        return attValue;
    } else {
        this.fireError("invalid attribute value declaration, must begin with a quote", FATAL);
    }
};

// [18]   	CDSect	   ::=   	 CDStart  CData  CDEnd
// [19]   	CDStart	   ::=   	'<![CDATA['
// [20]   	CData	   ::=   	(Char* - (Char* ']]>' Char*))
// [21]   	CDEnd	   ::=   	']]>'
SAXParser.prototype.scanCData = function() {
    if (this.xml.substr(this.index, 7) == "[CDATA[") {
        this.index += 7;
        this.ch = this.xml.charAt(this.index);
        if (this.lexicalHandler) {
            this.lexicalHandler.startCDATA();
        }
        // Reports the same as for text
        var start = this.index;
        var cdata = this.nextRegExp(/]]>/);
        var length = this.index - start;
        this.contentHandler.characters(cdata, start, length);
        //goes after final '>'
        this.index += 3;
        this.ch = this.xml.charAt(this.index);
        if (this.lexicalHandler) {
            this.lexicalHandler.endCDATA();
        }
        return true;
    } else {
        return false;
    }
};

// [66] CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
// current ch is char after &#
SAXParser.prototype.scanCharRef = function() {
    var oldIndex = this.index;
    if (this.ch == "x") {
        this.nextChar(true);
        while (this.ch != ";") {
            if (!/[0-9a-fA-F]/.test(this.ch)) {
                this.fireError("invalid char reference beginning with x, must contain alphanumeric characters only", ERROR);
            }
            this.nextChar(true);
        }
    } else {
        this.nextChar(true);
        while (this.ch != ";") {
            if (!/\d/.test(this.ch)) {
                this.fireError("invalid char reference, must contain numeric characters only", ERROR);
            }
            this.nextChar(true);
        }
    }
    return this.xml.substring(oldIndex, this.index);
};

//[68]  EntityRef ::= '&' Name ';'
SAXParser.prototype.scanEntityRef = function() {
    try {
        var ref = this.nextRegExp(/;/);
        if (this.lexicalHandler) {
            this.lexicalHandler.startEntity(ref);
            this.lexicalHandler.endEntity(ref);
        }
        return ref;
    //adding a message in that case
    } catch(e) {
        if (e instanceof EndOfInputException) {
            this.fireError("document incomplete, entity reference must end with ;", FATAL);
        } else {
            throw e;
        }
    }
};

// [42] ETag ::= '</' Name S? '>'
SAXParser.prototype.scanEndingTag = function() {
    var qName = this.getQName();
    var namespaceURI = this.getNamespaceURI(qName.prefix);
    if (qName.qName == this.elementsStack.pop()) {
        this.skipWhiteSpaces();
        if (this.ch == ">") {
            this.endMarkup(namespaceURI, qName);
            this.nextChar(true);
            return true;
        } else {
            this.fireError("invalid ending markup, does not finish with &gt;", FATAL);
        }
    } else {
        this.fireError("invalid ending markup, markup name does not match current one", FATAL);
    }
};


SAXParser.prototype.endMarkup = function(namespaceURI, qName) {
    this.contentHandler.endElement(namespaceURI, qName.localName, qName.qName);
    var namespacesRemoved = this.namespaces.pop();
    for (var i in namespacesRemoved) {
        this.contentHandler.endPrefixMapping(i);
    }
};


/*
if dontSkipWhiteSpace is not passed, then it is false so skipWhiteSpaces is default
if end of document, char is  ''
*/
SAXParser.prototype.nextChar = function(dontSkipWhiteSpace) {
    this.index++;
    this.ch = this.xml.charAt(this.index);
    if (!dontSkipWhiteSpace) {
        this.skipWhiteSpaces();
    }
    if (this.index >= this.length) {
        throw new EndOfInputException();
    }
};

SAXParser.prototype.skipWhiteSpaces = function() {
    while (/[\t\n\r ]/.test(this.ch)) {
        this.index++;
        if (this.index >= this.length) {
            throw new EndOfInputException();
        }
        this.ch = this.xml.charAt(this.index);
    }
};


/*
goes to next reg exp and return content, from current char to the char before reg exp
if next reg exp is not found return false, must differenciate from ''
*/
SAXParser.prototype.nextRegExp = function(regExp) {
    var oldIndex = this.index;
    var inc = this.xml.substr(this.index).search(regExp);
    if (inc == -1) {
        throw new EndOfInputException();
    } else {
        this.index += inc;
        this.ch = this.xml.charAt(this.index);
        return this.xml.substring(oldIndex, this.index);
    }
};

/*
[4]   	NameChar	   ::=   	 Letter | Digit | '.' | '-' | '_' | ':' | CombiningChar | Extender
[5]   	Name	   ::=   	(Letter | '_' | ':') (NameChar)*
*/
SAXParser.prototype.nextName = function() {
    return this.nextRegExp(NOT_START_OR_END_CHAR);
};


SAXParser.prototype.nextGT = function() {
    var content = this.nextRegExp(/>/);
    this.index++;
    this.ch = this.xml.charAt(this.index);
    return content;
};

/*
goes after ' or " and return content
current char is opening ' or "
*/
SAXParser.prototype.quoteContent = function() {
    this.index++;
    var content = this.nextRegExp(this.ch);
    this.index++;
    this.ch = this.xml.charAt(this.index);
    return content;
};

SAXParser.prototype.fireError = function(message, gravity) {
    var saxException = new SAXException(message);
    saxException.ch = this.ch;
    saxException.index = this.index;
    if (gravity == WARNING) {
        this.contentHandler.warning(saxException);
    } else if (gravity == ERROR) {
        this.contentHandler.error(saxException);
    } else if (gravity == FATAL) {
        throw(saxException);
    }
};

function Sax_QName(prefix, localName) {
    this.prefix = prefix;
    this.localName = localName;
    if (prefix != "") {
        this.qName = prefix + ":" + localName;
    } else {
        this.qName = localName;
    }
}

Sax_QName.prototype.equals = function(qName) {
    return this.qName == qName.qName;
};

/*
 int 	getIndex(java.lang.String qName)
          Look up the index of an attribute by XML qualified (prefixed) name.
 int 	getIndex(java.lang.String uri, java.lang.String localName)
          Look up the index of an attribute by Namespace name.
 int 	getLength()
          Return the number of attributes in the list.
 java.lang.String 	getLocalName(int index)
          Look up an attribute's local name by index.
 java.lang.String 	getQName(int index)
          Look up an attribute's XML qualified (prefixed) name by index.
 java.lang.String 	getType(int index)
          Look up an attribute's type by index.
 java.lang.String 	getType(java.lang.String qName)
          Look up an attribute's type by XML qualified (prefixed) name.
 java.lang.String 	getType(java.lang.String uri, java.lang.String localName)
          Look up an attribute's type by Namespace name.
 java.lang.String 	getURI(int index)
          Look up an attribute's Namespace URI by index.
 java.lang.String 	getValue(int index)
          Look up an attribute's value by index.
 java.lang.String 	getValue(java.lang.String qName)
          Look up an attribute's value by XML qualified (prefixed) name.
 java.lang.String 	getValue(java.lang.String uri, java.lang.String localName)
          Look up an attribute's value by Namespace name.
 */
// Change to Attributes2Impl class instead?
function Sax_Attributes(attsArray) {
    this.attsArray = attsArray;    
}
Sax_Attributes.prototype.getIndex = function(arg1, arg2) {
    if (arg2 == undefined) {
        return this.getIndexByQName(arg1);
    } else {
        return this.getIndexByURI(arg1, arg2);
    }
};
Sax_Attributes.prototype.getIndexByQName = function(qName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].qName.equals(qName)) {
            return i;
        }
    }
    return -1;
};
Sax_Attributes.prototype.getIndexByURI = function(uri, localName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].namespaceURI == uri && this.attsArray[i].qName.localName == localName) {
            return i;
        }
    }
    return -1;
};
Sax_Attributes.prototype.getLength = function() {
    return this.attsArray.length;
};
Sax_Attributes.prototype.getLocalName = function(index) {
    return this.attsArray[index].qName.localName;
};
Sax_Attributes.prototype.getQName = function(index) {
    return this.attsArray[index].qName.qName;
};
//not supported
Sax_Attributes.prototype.getType = function(arg1, arg2) {
    return "CDATA";
};
Sax_Attributes.prototype.getURI = function(index) {
    return this.attsArray[index].namespaceURI;
};
Sax_Attributes.prototype.getValue = function(arg1, arg2) {
    if (arg2 == undefined) {
        if (typeof arg1 == "string") {
            return this.getValueByQName(arg1);
        } else {
            return this.getValueByIndex(arg1);
        }
    } else {
        return this.getValueByURI(arg1, arg2);
    }
};
Sax_Attributes.prototype.getValueByIndex = function(index) {
    return this.attsArray[index].value;
};
Sax_Attributes.prototype.getValueByQName = function(qName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].qName.equals(qName)) {
            return this.attsArray[i].value;
        }
    }
};
Sax_Attributes.prototype.getValueByURI = function(uri, localName) {
    for (var i in this.attsArray) {
        if (this.attsArray[i].namespaceURI == uri && this.attsArray[i].qName.localName == localName) {
            return this.attsArray[i].value;
        }
    }
};


function Sax_Attribute(qName, namespaceURI, value) {
    this.qName = qName;
    this.namespaceURI = namespaceURI;
    this.value = value;
}

function SAXException(message, exception) {
    this.message = message;
    this.exception = exception;
}

// Not fully implemented
function SAXNotSupportedException (msg) { // java.lang.Exception
    return new Error(msg || '');
}
function SAXNotRecognizedException (msg) { // java.lang.Exception
    return new Error(msg || '');
}

//This constructor is more complex and not presently implemented;
//  see Java API to implement additional arguments correctly
function SAXParseException (msg) { // java.lang.Exception //
    return new Error(msg || '');
}

// Should this perhaps extend SAXParseException?
function EndOfInputException() {}


// Add public API to global namespace (or other one, if we are in another)
this.SAXParser = SAXParser;
this.SAXException = SAXException;
this.SAXNotSupportedException = SAXNotSupportedException;
this.SAXNotRecognizedException = SAXNotRecognizedException;
this.SAXParseException = SAXParseException;

})(); // end namespace
