/*global window, AttributesImpl, SAXParseException, SAXParser */
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

/*
This is the private API for SAX parsing
*/
(function () { // Begin namespace

/* Scanner states */
var STATE_XML_DECL                  =  0;
var STATE_PROLOG                    =  1;
var STATE_EXT_ENT                   =  2;
var STATE_PROLOG_DOCTYPE_DECLARED   =  3;
var STATE_ROOT_ELEMENT              =  4;
var STATE_CONTENT                   =  5;
var STATE_TRAILING_MISC             =  6;

var XML_VERSIONS = ['1.0', '1.1']; // All existing versions of XML; will check this.features['http://xml.org/sax/features/xml-1.1'] if parser supports XML 1.1
var XML_VERSION = /^1\.\d+$/;
var ENCODING = /^[A-Za-z]([A-Za-z0-9._]|-)*$/;
var STANDALONE = /^yes$|^no$/;

/* XML Name regular expressions */
// Should disallow independent high or low surrogates or inversed surrogate pairs and also have option to reject private use characters; but strict mode will need to check for sequence of 2 characters if a surrogate is found
var NAME_START_CHAR = ":A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u0200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\ud800-\udbff\udc00-\udfff"; // The last two ranges are for surrogates that comprise #x10000-#xEFFFF; // Fix: Need to remove surrogate pairs here and handle elsewhere; also must deal with surrogates in entities
var NOT_START_CHAR = new RegExp("[^" + NAME_START_CHAR + "]");
var NAME_END_CHAR = ".0-9\u00B7\u0300-\u036F\u203F-\u2040-"; // Don't need escaping since to be put in a character class
var NOT_START_OR_END_CHAR = new RegExp("[^" + NAME_START_CHAR + NAME_END_CHAR + "]");

//[2]   	Char	   ::=   	#x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
//for performance reason I will not be conformant in applying this within the class (see CHAR_DATA_REGEXP)
var HIGH_SURR = "\ud800-\udbff"; // db7f cut-off would restrict private high surrogates
var LOW_SURR = "\udc00-\udfff";
var HIGH_SURR_EXP = new RegExp('['+HIGH_SURR+']');
var LOW_SURR_EXP = new RegExp('['+LOW_SURR+']');

var CHAR = "\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD";
var NOT_CHAR = '[^'+CHAR+']';
var NOT_A_CHAR = new RegExp(NOT_CHAR);
var NOT_A_CHAR_ERROR_CB = function () {
    if (this.ch.search(HIGH_SURR_EXP) !== -1) {
        var temp_ch = this.ch; // Remember for errors
        this.nextChar(true);
        if (this.ch.search(LOW_SURR_EXP) !== -1) {
            return true;
        }
        return this.saxEvents.fatalError("invalid XML character, high surrogate, decimal code number '"+temp_ch.charCodeAt(0)+"' not immediately followed by a low surrogate", this);
    }
    return this.saxEvents.fatalError("invalid XML character, decimal code number '"+this.ch.charCodeAt(0)+"'", this);
};
var NOT_A_CHAR_CB_OBJ = {pattern:NOT_A_CHAR, cb:NOT_A_CHAR_ERROR_CB};

var WS_CHARS = '\\t\\n\\r ';
var WS_CHAR = '['+WS_CHARS+']'; // \s is too inclusive
var WS = new RegExp(WS_CHAR);
var NON_WS = new RegExp('[^'+WS_CHARS+']');
//in the case of XML declaration document has not yet been processed, token is on <
var XML_DECL_BEGIN = new RegExp("<\\?xml"+WS_CHAR);
// in the case of detection of double XML declation, token is on ?
var XML_DECL_BEGIN_FALSE = new RegExp("xml("+WS_CHAR+'|\\?)', 'i');

var NOT_REPLACED_ENTITIES = /^amp$|^lt$|^gt$|^quot$/;
var APOS_ENTITY = /^apos$/;


// CUSTOM EXCEPTION CLASSES
// Our own exception class; should this perhaps extend SAXParseException?
function EndOfInputException() {}

EndOfInputException.prototype.toString = function() {
    return "EndOfInputException";
};

function EntityNotReplacedException(entityName) {
    this.entityName = entityName;
}
EntityNotReplacedException.prototype.toString = function() {
    return "EntityNotReplacedException";
};

function InternalEntityNotFoundException(entityName) {
    this.entityName = entityName;
}
InternalEntityNotFoundException.prototype.toString = function() {
    return "InternalEntityNotFoundException";
};
InternalEntityNotFoundException.prototype = new SAXParseException();
InternalEntityNotFoundException.constructor = InternalEntityNotFoundException;

// CUSTOM HELPER CLASSES
/*
in case of attributes, empty prefix will be null because default namespace is null for attributes
in case of elements, empty prefix will be "".
*/
function Sax_QName(prefix, localName) {
    this.prefix = prefix;
    this.localName = localName;
    if (prefix) {
        this.qName = prefix + ":" + localName;
    } else {
        this.qName = localName;
    }
}
Sax_QName.prototype.equals = function(qName) {
    return this.qName === qName.qName;
};

/*
Class for storing publicId and systemId
*/
function ExternalId() {
    this.publicId = null;
    this.systemId = null;
}
ExternalId.prototype.toString = function() {
    return "ExternalId";
};

function SAXScanner(saxParser, saxEvents) {
    this.saxParser = saxParser;
    this.saxEvents = saxEvents;
    this.NOT_CHAR = NOT_CHAR; // Set for access by SAXParser.parseString()
}
SAXScanner.prototype.toString = function() {
    return "SAXScanner";
};

SAXScanner.prototype.init = function() {
    this.state = STATE_XML_DECL;
    this.elementsStack = [];
    this.namespaceSupport.reset();
    /* map between entity names and values */
    this.entities = {};
    /* map between parameter entity names and values
            the parameter entites are used inside the DTD */
    this.parameterEntities = {};
    /* map between external entity names and URIs  */
    this.externalEntities = {};
    /* in order to check for recursion inside entities */
    this.currentEntities = [];
    /* on each depth, a relative base URI, empty if no xml:base found, is recorded */
    this.relativeBaseUris = [];
}

// BEGIN CUSTOM API (could make all but parse() private)
SAXScanner.prototype.parse = function(reader) { // We implement our own for now, but should probably call the standard parse() which requires an InputSource object (or systemId string)
    this.init();
    try {
        this.reader = new ReaderWrapper(reader);
        this.saxEvents.startDocument();
        // We must test for the XML Declaration before processing any whitespace
        this.startParsing();
        this.state = STATE_PROLOG;
        this.parseStringFromIdx();
    } catch(e) {
        if (e instanceof EndOfInputException) {
            if (this.elementsStack.length > 0) {
                this.saxEvents.fatalError("the markup " + this.elementsStack.pop() + " has not been closed", this);
            } else {
                try {
                    //maybe validation exceptions
                    this.saxEvents.endDocument();
                } catch(e2) {
                    throw e2;
                }
            }
        } else {
            throw e;
        }
    }
};


/*
scan XML declaration, test first character of document, and if right goes to character after <
*/
SAXScanner.prototype.startParsing = function() {
    try {
        this.nextChar(true);
    } catch(e) {
        if (e instanceof EndOfInputException) {
            this.saxEvents.fatalError("empty document", this);
        } else {
            throw e;
        }
    }
    //if no XML declaration, then white spaces are allowed at beginning of XML
    if (!this.scanXMLDeclOrTextDecl()) {
        try {
            this.skipWhiteSpaces();
        } catch(e) {
            //if all whitespaces, w3c test case xmlconf/xmltest/not-wf/sa/050.xml
            if (e instanceof EndOfInputException) {
                this.saxEvents.fatalError("empty document", this);
            } else {
                throw e;
            }
        }
    }
    if (this.ch !== "<") {
        this.saxEvents.fatalError("Invalid first character in document, external entity or external subset : [" + this.ch + "]", this);
    }
};

/*
used for integration with codemirror
each iteration of that while must be the end of a token
end of a markup or end of a text
*/
SAXScanner.prototype.parseStringFromIdx = function() {
    while (true) {
        this.next();
        this.nextChar(true);
    }
}

SAXScanner.prototype.next = function() {
    if (this.elementsStack.length === 0) {
        this.skipWhiteSpaces();
        if (this.ch === "<") {
            this.nextChar(true);
            this.scanMarkup();
        } else {
            this.saxEvents.fatalError("can not have text at root level of the XML", this);
        }
    } else {
        if (this.ch === "<") {
            this.nextChar(true);
            this.scanMarkup();
        } else {
            this.scanText();
        }
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
SAXScanner.prototype.scanMarkup = function() {
    if (this.state === STATE_PROLOG) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                //there is no other choice but, in case exception is not FATAL,
                // and in order to have equivalent behaviours between scan()
                if (this.scanDoctypeDecl()) {
                    this.state = STATE_PROLOG_DOCTYPE_DECLARED;
                }
            }
        } else if (this.ch === "?") {
            this.nextChar(true);
            //in case it is not a valid processing instruction
            //scanPI will throw the exception itself, with a better message
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanMarkup();
        }
    } else if (this.state === STATE_PROLOG_DOCTYPE_DECLARED) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                if (this.matchStr("DOCTYPE")) {
                    this.saxEvents.fatalError("can not have two doctype declarations", this);
                } else {
                    this.saxEvents.fatalError("invalid declaration, only a comment is allowed here after &lt;!", this);
                }
            }
        } else if (this.ch === "?") {
            this.nextChar(true);
            //in case it is not a valid processing instruction
            //scanPI will throw the exception itself, with a better message
            this.scanPI();
        } else {
            this.state = STATE_ROOT_ELEMENT;
            //does not go to next char exiting the method
            this.scanMarkup();
        }
    } else if (this.state === STATE_ROOT_ELEMENT) {
        if (this.scanElement()) {
            //there may be just a root empty markup (already closed)
            if (this.elementsStack.length > 0) {
                this.state = STATE_CONTENT;
            } else {
                this.state = STATE_TRAILING_MISC;
            }
        } else {
            this.saxEvents.fatalError("document is empty, no root element detected", this);
        }
    } else if (this.state === STATE_CONTENT) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                if (!this.scanCData()) {
                    this.saxEvents.fatalError("neither comment nor CDATA after &lt;!", this);
                }
            }
        } else if (this.ch === "?") {
            this.nextChar(true);
            //in case it is not a valid processing instruction
            //scanPI will throw the exception itself, with a better message
            this.scanPI();
        } else if (this.ch === "/") {
            this.nextChar(true);
            if (this.scanEndingTag()) {
                if (this.elementsStack.length === 0) {
                    this.state = STATE_TRAILING_MISC;
                }
            }
        } else {
            if (!this.scanElement()) {
                this.saxEvents.fatalError("not valid markup", this);
            }
        }
    } else if (this.state === STATE_TRAILING_MISC) {
        if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                this.saxEvents.fatalError("end of document, only comments or processing instructions are allowed", this);
            }
        } else if (this.ch === "?") {
            this.nextChar(true);
            if (!this.scanPI()) {
                this.saxEvents.fatalError("end of document, only comment or processing instruction are allowed", this);
            }
        } else if (this.ch === "/") {
            this.saxEvents.fatalError("invalid ending tag at root of the document", this);
        } else {
            this.saxEvents.fatalError("only one document element is allowed", this);
        }
    }
};

//  what I understand from there : http://www.w3.org/TR/REC-xml/#dt-chardata is that & is allowed
// in character data only if it is an entity reference
SAXScanner.prototype.scanText = function() {
    var content = this.scanCharData();
    //in case of external entity, the process is reinitialized??
    //if found a "&"
    while (this.ch === "&") {
        this.nextChar(true);
        try {
            this.scanRef();
        } catch(e) {
            if (e instanceof EntityNotReplacedException) {
                content += "&" + e.entityName + ";";
            } else if (e instanceof InternalEntityNotFoundException) {
                // at this place in XML, that entity ref may be an external entity
                var externalId = this.externalEntities[e.entityName];
                if (externalId === undefined) {
                    this.saxEvents.error("entity : [" + e.entityName + "] not declared as an internal entity or as an external one", this);
                } else {
                    this.includeEntity(e.entityName, externalId);
                }
            } else {
                throw e;
            }
        }
        content += this.scanCharData();
    }
    if (content.search(NON_WS) === -1) {
        this.saxEvents.ignorableWhitespace(content, 0, content.length);
    } else {
        this.saxEvents.characters(content, 0, content.length);
    }
};

// 14]   	CharData ::= [^<&]* - ([^<&]* ']]>' [^<&]*)
SAXScanner.prototype.scanCharData = function() {
    var content = this.nextCharRegExp(this.CHAR_DATA_REGEXP, NOT_A_CHAR_CB_OBJ);
    //if found a "]", must ensure that it is not followed by "]>"
    while (this.isFollowedByCh("]")) {
        if (this.matchStr("]]>")) {
            this.saxEvents.error("Text must not contain a literal ']]&gt;' sequence", this);
        }
        content += this.nextCharRegExp(this.CHAR_DATA_REGEXP, NOT_A_CHAR_CB_OBJ);
    }
    return content;
};


SAXScanner.prototype.getRelativeBaseUri = function() {
    var returned = this.saxParser.baseURI;
    var i = this.relativeBaseUris.length;
    while (i--) {
        returned += this.relativeBaseUris[i];
    }
    return returned;
};

/*
 entity is replaced and its replacement is parsed, see http://www.w3.org/TR/REC-xml/#included
 entityName is used for SAX compliance with resolveEntity and recursion detection
 reader must have been marked at entity start index
 */
SAXScanner.prototype.includeEntity = function(entityName, replacement) {
    //if it is an externalId, have to include the external content
    if (replacement instanceof ExternalId) {
        try {
            //it seems externalEntity does not take in account xml:base, see xmlconf.xml
            var externalEntity = this.saxEvents.resolveEntity(entityName, replacement.publicId, this.saxParser.baseURI, replacement.systemId);
            //if not only whitespace
            if (externalEntity !== undefined && externalEntity.search(NON_WS) !== -1) {
                //check for no recursion
                if (externalEntity.search(new RegExp("&" + entityName + ";")) !== -1) {
                    this.saxEvents.fatalError("Recursion detected : [" + entityName + "] contains a reference to itself", this);
                }
                //there may be another xml declaration at beginning of external entity
                this.includeText(externalEntity);
                var oldState = this.state;
                this.state = STATE_EXT_ENT;
                this.startParsing();
                this.state = oldState;
            }
        } catch(e) {
            this.saxEvents.error("issue at resolving entity : [" + entityName + "], publicId : [" + replacement.publicId + "], uri : [" + this.saxParser.baseURI + "], systemId : [" + replacement.systemId + "], got exception : [" + e.toString() + "]", this);
            this.nextChar(true);
        }
    } else {
        //check for no recursion
        if (replacement.search(new RegExp("&" + entityName + ";")) !== -1) {
            this.saxEvents.fatalError("Recursion detected : [" + entityName + "] contains a reference to itself", this);
        }
        this.includeText(replacement);
    }
};

SAXScanner.prototype.includeText = function(replacement) {
    // entity is replaced and its replacement is parsed, see http://www.w3.org/TR/REC-xml/#included
    this.reader.unread(replacement);
    this.nextChar(true);
};

/*
current char is after '&'
does not return the replacement, it is added to the xml
may throw exception if entity has not been found (if external for example)
*/
SAXScanner.prototype.scanRef = function() {
    if (this.ch === "#") {
        this.nextChar(true);
        this.scanCharRef();
    } else {
        this.scanEntityRef();
    }
};


// [15] Comment ::= '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'
SAXScanner.prototype.scanComment = function() {
    if (this.ch === "-") {
        this.nextChar(true);
        if (this.ch === "-") {
            //do not skip white space at beginning of comment
            this.nextChar(true);
            var comment = this.nextCharRegExp(new RegExp(NOT_CHAR+'|-'), NOT_A_CHAR_CB_OBJ);
            this.nextChar(true);
            while (this.ch === "-") {
                if (this.matchStr("-->")) {
                    break;
                }
                else if (this.isFollowedByCh("-")) {
                    return this.saxEvents.fatalError("end of comment not valid, must be --&gt;", this);
                }
                comment += this.nextCharRegExp(new RegExp(NOT_CHAR+'|-'), NOT_A_CHAR_CB_OBJ);
                this.nextChar(true);
            }
            this.saxEvents.comment(comment, 0, comment.length);// Brett (test for support and change start/length?)
            return true;
        } else {
            return this.saxEvents.fatalError("beginning comment markup is invalid, must be &lt;!--", this);
        }
    } else {
        // can be a doctype
        return false;
    }
};


SAXScanner.prototype.setEncoding = function (encoding) {
    if (this.saxParser.contentHandler.locator) {
        this.saxParser.contentHandler.locator.setEncoding(this.encoding || encoding); // Higher priority is given to any encoding set on an InputSource (passed in during parse())
    }
};

SAXScanner.prototype.setXMLVersion = function (version) {
   if (version) {
        if (XML_VERSIONS.indexOf(version) === -1) {
            this.saxEvents.fatalError("The specified XML Version is not a presently valid XML version number", this); // e.g. 1.5
        } else if (version === '1.1' && this.saxParser.features['http://xml.org/sax/features/xml-1.1'] === false) {
            this.saxEvents.fatalError("The XML text specifies version 1.1, but this parser does not support this version.", this);
        }
        this.saxParser.properties['http://xml.org/sax/properties/document-xml-version'] = version;
        if (this.saxParser.contentHandler.locator) {
            this.saxParser.contentHandler.locator.setXMLVersion(version);
        }
    }
};

SAXScanner.prototype.scanXMLDeclOrTextDeclAttribute = function (allowableAtts, allowableValues, requireWS) {
    if (this.ch === "?") {
        return false;
    }
    if (requireWS && this.ch.search(WS) === -1) {
        return this.saxEvents.fatalError('The XML Declaration or Text Declaration must possess a space between the version/encoding/standalone information.', this);
    }
    this.skipWhiteSpaces();
    var attName = this.scanName();
    var attPos = allowableAtts.indexOf(attName);
    if (attPos === -1) {
        if (['version', 'encoding', 'standalone'].indexOf(attName) !== -1) {
            return this.saxEvents.fatalError('The attribute name "'+attName+'" was not expected at this position in an XML or text declaration. It was expected to be: '+allowableAtts.join(', '), this);
        }
        return this.saxEvents.fatalError('The attribute name "'+attName+'" does not match the allowable names in an XML or text declaration: '+allowableAtts.join(', '), this);
    }
    this.nextChar();
    if (this.ch === "=") {
        this.nextChar();
        if (this.ch === '"' || this.ch === "'") {
            try {
                var attValue = this.quoteContent();
                if (attValue.search(allowableValues[attPos]) === -1) {
                    return this.saxEvents.fatalError('The attribute value "'+attValue+'" does not match the allowable values in an XML or text declaration: '+allowableValues[attPos], this);
                }
                //current char is ending quote
                this.nextChar(true);
            //adding a message in that case
            } catch(e) {
                if (e instanceof EndOfInputException) {
                    return this.saxEvents.fatalError("document incomplete, attribute value declaration must end with a quote", this);
                } else {
                    throw e;
                }
            }
        } else {
            return this.saxEvents.fatalError("invalid declaration attribute value declaration, must begin with a quote", this);
        }
    } else {
        return this.saxEvents.fatalError("invalid declaration attribute, must contain = between name and value", this);
    }
    return [attName, attValue];
};

/*
 [23] XMLDecl ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
 [24] VersionInfo ::= S 'version' Eq (' VersionNum ' | " VersionNum ")
 [80] EncodingDecl ::= S 'encoding' Eq ('"' EncName '"' |  "'" EncName "'" )
 [81] EncName ::= [A-Za-z] ([A-Za-z0-9._] | '-')*
 [32] SDDecl ::= S 'standalone' Eq (("'" ('yes' | 'no') "'")
                 | ('"' ('yes' | 'no') '"'))
 [77] TextDecl ::= '<?xml' VersionInfo? EncodingDecl S? '?>'
 current character is "<", at return current char is exceptionally after ">" because parsing is just starting, so first character must stay the
first character of document
 */
SAXScanner.prototype.scanXMLDeclOrTextDecl = function() {
    // Fix: need to have conditions to trigger STATE_EXT_ENT somehow
    // allow scanning of text declaration/external XML entity?
    var version = null;
    var encoding = 'UTF-8'; // As the default with no declaration is UTF-8, we assume it is such, unless the
    // encoding is indicated explicitly, in which case we will trust that. We are therefore not able to discern
    // UTF-16 represented without an explicit declaration nor report any inconsistencies between header encoding,
    // byte-order mark, or explicit encoding information, unless it is reported on InputSource (see next note).

    // If we were processing individual bytes (e.g., if we represented XML as an array of bytes), we
    //    could detect the encoding ourselves, including byte-order mark (and also allow checking
    //    against any header encoding), but since JavaScript converts pages for us into UTF-16 (two bytes per
    //    character), we cannot use the same approach unless we allow the InputSource with the InputStream (byteStream)
    //    constructor in Java SAX2; instead we take an approach more similar to the StringReader (Reader characterStream
    //    constructor), though we haven't fully implemented that API at present: http://java.sun.com/j2se/1.4.2/docs/api/java/io/StringReader.html
    // This script will therefore not detect an inconsistency between the encoding of the original document (since
    //    we don't know what it is) and the encoding indicated in its (optional) XML Declaration/Text Declaration

    if (this.matchRegExp(6, XML_DECL_BEGIN)) {
        var standalone = false;
        if (this.state === STATE_XML_DECL) {
            var versionArr = this.scanXMLDeclOrTextDeclAttribute(['version'], [XML_VERSION]);
            if (!versionArr) {
                return this.saxEvents.fatalError("An XML Declaration must have version information", this);
            }
            version = versionArr[1];
            this.setXMLVersion(version);
            var encodingOrStandalone = this.scanXMLDeclOrTextDeclAttribute(['encoding', 'standalone'], [ENCODING, STANDALONE], true);
            if (encodingOrStandalone) {
                if (encodingOrStandalone[0] === 'encoding') {
                    encoding = encodingOrStandalone[1];
                    this.setEncoding(encoding);
                    
                    var standaloneArr = this.scanXMLDeclOrTextDeclAttribute(['standalone'], [STANDALONE], true);
                    if (standaloneArr && standaloneArr === 'yes') {
                        standalone = true;
                    }
                }
            }
            this.saxParser.features['http://xml.org/sax/features/is-standalone'] = standalone;
        } else { // STATE_EXT_ENT
            var versionOrEncodingArr = this.scanXMLDeclOrTextDeclAttribute(['version', 'encoding'], [XML_VERSION, ENCODING]);
            if (versionOrEncodingArr[0] === 'version') {
                version = versionOrEncodingArr[1];
                this.setXMLVersion(version);
                versionOrEncodingArr = this.scanXMLDeclOrTextDeclAttribute(['encoding'], [ENCODING], true);
            }
            if (!versionOrEncodingArr) {
                return this.saxEvents.fatalError("A text declaration must possess explicit encoding information", this);
            }
            encoding = versionOrEncodingArr[1];
            this.setEncoding(encoding);
        }

        this.skipWhiteSpaces();
        if (this.ch !== "?") {
            return this.saxEvents.fatalError("invalid markup, '"+this.ch+"', in XML or text declaration where '?' expected", this);
        }
        this.nextChar(true);
        if (this.ch !== ">") {
            return this.saxEvents.fatalError("invalid markup inside XML or text declaration; must end with &gt;", this);
        }
        this.nextChar();
        return true;
    } else {
        if (this.state === STATE_XML_DECL) {
            this.setXMLVersion('1.0'); // Assumed when no declaration present
            if (this.saxParser.contentHandler.locator) {
                this.saxParser.contentHandler.locator.setEncoding(encoding);
            }
            this.saxParser.features['http://xml.org/sax/features/is-standalone'] = false;
        }
        return false;
    }
};


// [16] PI ::= '<?' PITarget (S (Char* - (Char* '?>' Char*)))? '?>'
// [17] PITarget ::= Name - (('X' | 'x') ('M' | 'm') ('L' | 'l'))
/*
current char is '?'
*/
SAXScanner.prototype.scanPI = function() {
    if (this.matchRegExp(4, XML_DECL_BEGIN_FALSE)) {
        return this.saxEvents.fatalError("XML Declaration cannot occur past the very beginning of the document.", this);
    }
    var piName = this.scanName();
    this.nextChar();
    var piData = this.nextCharRegExp(new RegExp(NOT_CHAR+'|\\?'), NOT_A_CHAR_CB_OBJ);
    this.nextChar(true);
    //if found a "?", end if it is followed by ">"
    while (this.ch === "?") {
        this.nextChar(true);
        if (this.ch === ">") {
            break;
        }
        piData += "?" + this.nextCharRegExp(new RegExp(NOT_CHAR+'|\\?'), NOT_A_CHAR_CB_OBJ);
        this.nextChar(true);
    }
    this.saxEvents.processingInstruction(piName, piData);
    return true;
};


SAXScanner.prototype.loadExternalDtd = function(externalId) {
    //in case of restricted uri error
    try {
        var uri;
        //in case xml is loaded from string (do we load dtd in that case ?)
        if (this.saxParser.baseURI) {
            uri = this.saxParser.baseURI + externalId.systemId;
        } else {
            uri = externalId.systemId;
        }
        var extSubset = SAXParser.loadFile(uri);
        this.scanExtSubset(extSubset);
    } catch(e) {
        this.saxEvents.warning("exception : [" + e.toString() + "] trying to load external subset : [" + this.saxParser.baseURI + externalId.systemId + "]", this);
    }
}

//[28]   	doctypedecl	   ::=   	'<!DOCTYPE' S  Name (S  ExternalID)? S? ('[' intSubset ']' S?)? '>'
SAXScanner.prototype.scanDoctypeDecl = function() {
    if (this.matchStr("DOCTYPE")) {
        this.nextChar();
        var name = this.nextCharRegExp(/[ \[>]/);
        this.nextChar();
        var externalId = new ExternalId();
        //if there is an externalId
        if (this.scanExternalId(externalId)) {
            this.nextChar();
        }
        this.saxEvents.startDTD(name, externalId.publicId, externalId.systemId);
        if (this.ch === "[") {
            this.nextChar();
            while (this.ch !== "]") {
                this.scanDoctypeDeclIntSubset();
                //ending char must be ">"
                this.nextChar();
            }
            this.nextChar();
        }
        //extract of specs : if both the external and internal subsets are used, the internal subset MUST be considered to occur before the external subset
        if (externalId.systemId !== null) {
            this.loadExternalDtd(externalId);
        }
        if (this.ch !== ">") {
            return this.saxEvents.fatalError("invalid content in doctype declaration", this);
        }
        this.saxEvents.endDTD();
        return true;
    } else {
        return this.saxEvents.fatalError("invalid doctype declaration, must be &lt;!DOCTYPE", this);
    }
};

/*
[30]   	extSubset	   ::=   	 TextDecl? extSubsetDecl
[31]   	extSubsetDecl	   ::=   	( markupdecl | conditionalSect | DeclSep)*
*/
SAXScanner.prototype.scanExtSubset = function(extSubset) {
    if (extSubset.search(NON_WS) !== -1) {
        var oldReader = this.reader;
        this.reader = new StringReader(extSubset);
        this.nextChar(true);
        this.startParsing();
        //current char is first <
        try {
            //should also support conditionalSect
            this.scanDoctypeDeclIntSubset();
        } catch(e) {
            if (!(e instanceof EndOfInputException)) {
                throw e;
            }
        }
        this.reader = oldReader;
    }
};

//[75]   	ExternalID	   ::=   	'SYSTEM' S  SystemLiteral
//			| 'PUBLIC' S PubidLiteral S SystemLiteral
/*
current char is first non whitespace char
ending char is ending quote
*/
SAXScanner.prototype.scanExternalId = function(externalId) {
    if (this.matchStr("SYSTEM")) {
        this.nextChar();
        externalId.systemId = this.scanSystemLiteral();
        return true;
    } else if (this.matchStr("PUBLIC")) {
        this.nextChar();
        externalId.publicId = this.scanPubIdLiteral();
        this.nextChar();
        externalId.systemId = this.scanSystemLiteral();
        return true;
    }
    return false;
};

//current char should be the quote
//[11]   	SystemLiteral	   ::=   	('"' [^"]* '"') | ("'" [^']* "'")
SAXScanner.prototype.scanSystemLiteral = function(externalId) {
    if (this.ch !== "'" && this.ch !== '"') {
        return this.saxEvents.fatalError("invalid sytem Id declaration, should begin with a quote", this);
    }
    return this.quoteContent();
};

//current char should be the quote
//[12]   	PubidLiteral	   ::=   	'"' PubidChar* '"' | "'" (PubidChar - "'")* "'"
//[13]   	PubidChar	   ::=   	#x20 | #xD | #xA | [a-zA-Z0-9] | [-'()+,./:=?;!*#@$_%]
SAXScanner.prototype.scanPubIdLiteral = function(externalId) {
    if (this.ch !== "'" && this.ch !== '"') {
        return this.saxEvents.fatalError("invalid Public Id declaration, should begin with a quote", this);
    }
    return this.quoteContent();
};

/*
Parameter entity references are recognized anywhere in the DTD (internal and external subsets and external parameter entities),
except in literals, processing instructions, comments, and the contents of ignored conditional sections
current char is %
*/
SAXScanner.prototype.includeParameterEntity = function() {
    this.nextChar(true);
    var entityName = this.nextCharWhileNot(";");
    this.nextChar(true);
    // if % found here, include and parse replacement
    var replacement = this.scanPeRef(entityName);
    //current char is ending quote
    this.nextChar(true);
    // entity is replaced and its replacement is parsed, see http://www.w3.org/TR/REC-xml/#included
    this.includeEntity(entityName, replacement);
    //white spaces are not significant here
    this.skipWhiteSpaces();
};

/*
actual char is non whitespace char after '['
[28a]   	DeclSep	   ::=   	 PEReference | S
[28b]   	intSubset	   ::=   	(markupdecl | DeclSep)*
[29]   	markupdecl	   ::=   	 elementdecl | AttlistDecl | EntityDecl | NotationDecl | PI | Comment
*/
SAXScanner.prototype.scanDoctypeDeclIntSubset = function() {
    if (this.ch === "<") {
        this.nextChar(true);
        if (this.ch === "?") {
            this.nextChar(true);
            if (!this.scanPI()) {
                this.saxEvents.fatalError("invalid processing instruction inside doctype declaration", this);
            }
        } else if (this.ch === "!") {
            this.nextChar(true);
            if (!this.scanComment()) {
                if (!this.scanEntityDecl() && !this.scanElementDecl() &&
                        !this.scanAttlistDecl() && !this.scanNotationDecl()) {
                    //no present support for other declarations
                    this.nextCharWhileNot(">");
                }
                this.nextChar();
                if (this.ch !== ">") {
                    this.saxEvents.fatalError("invalid markup declaration inside doctype declaration, must end with &gt;", this);
                }
            } else {
                //if comment, must go over the whitespaces as they are not significative in doctype internal subset declaration
                this.skipWhiteSpaces();
            }
        }
    /*
    Reference in DTD	 Included as PE
*/
    } else if (this.ch === "%") {
        this.includeParameterEntity();
    } else {
        this.saxEvents.fatalError("invalid character in internal subset of doctype declaration : [" + this.ch + "]", this);
    }
};

/*
[70]   	EntityDecl	   ::=   	 GEDecl  | PEDecl
[71]   	          GEDecl	   ::=   	'<!ENTITY' S  Name  S  EntityDef  S? '>'
[72]   	PEDecl	   ::=   	'<!ENTITY' S '%' S Name S PEDef S? '>'
[73]   	EntityDef	   ::=   	 EntityValue  | (ExternalID  NDataDecl?)
[74]   	PEDef	   ::=   	EntityValue | ExternalID
[75]   	ExternalID	   ::=   	'SYSTEM' S  SystemLiteral
			| 'PUBLIC' S PubidLiteral S SystemLiteral
[76]   	NDataDecl	   ::=   	S 'NDATA' S Name
*/
SAXScanner.prototype.scanEntityDecl = function() {
    var entityName, externalId, entityValue;
    if (this.matchStr("ENTITY")) {
        this.nextChar();
        if (this.ch === "%") {
            this.nextChar();
            entityName = this.scanName();
            this.nextChar();
            //if already declared, not effective
            if (!this.parameterEntities[entityName]) {
                externalId = new ExternalId();
                if (!this.scanExternalId(externalId)) {
                    entityValue = this.scanEntityValue();
                    this.parameterEntities[entityName] = entityValue;
                    this.saxEvents.internalEntityDecl("%" + entityName, entityValue);
                } else {
                    this.parameterEntities[entityName] = externalId;
                }
            } else {
                var ignored = this.nextCharWhileNot(">");
                //an XML processor MAY issue a warning if entities are declared multiple times.
                this.saxEvents.warning("entity : [" + entityName + "] is declared several times, only first value : [" + this.parameterEntities[entityName] + "] is effective, declaration : [" + ignored + "] is ignored");
            }
        } else {
            entityName = this.scanName();
            this.nextChar();
            //if already declared, not effective
            if (!this.entities[entityName]) {
                externalId = new ExternalId();
                if (this.scanExternalId(externalId)) {
                    if (this.matchStr("NDATA")) {
                        this.nextChar();
                        var ndataName = this.scanName();
                        this.saxEvents.unparsedEntityDecl(entityName, externalId.publicId, externalId.systemId, ndataName);
                    }
                    this.externalEntities[entityName] = externalId;
                } else {
                    entityValue = this.scanEntityValue();
                    if (this.isEntityReferencingItself(entityName, entityValue)) {
                        this.saxEvents.error("circular entity declaration, entity : [" + entityName + "] is referencing itself directly or indirectly", this);
                    } else {
                        this.entities[entityName] = entityValue;
                        this.saxEvents.internalEntityDecl(entityName, entityValue);
                    }
                }
            } else {
                var ignored = this.nextCharWhileNot(">");
                //an XML processor MAY issue a warning if entities are declared multiple times.
                this.saxEvents.warning("entity : [" + entityName + "] is declared several times, only first value : [" + this.entities[entityName] + "] is effective, declaration : [" + ignored + "] is ignored");
            }
        }
        return true;
    }
    return false;
};
/*
false is OK
*/
SAXScanner.prototype.isEntityReferencingItself = function(entityName, entityValue) {
    var parsedValue = /^[^&]*&([^;]+);(.*)/.exec(entityValue);
    if (parsedValue !== null) {
        // parsedValue[1] is the name of the nested entity
        if (parsedValue[1] === entityName) {
            return true;
        } else {
            var replacement = this.entities[parsedValue[1]];
            //if already declared
            if (replacement !== undefined) {
                var check = this.isEntityReferencingItself(entityName, replacement);
                return check || this.isEntityReferencingItself(entityName, parsedValue[2]);
            } else {
                return this.isEntityReferencingItself(entityName, parsedValue[2]);
            }
        }
    } else {
        return false;
    }
};

/*
[9]   	EntityValue	   ::=   	'"' ([^%&"] | PEReference | Reference)* '"'
			|  "'" ([^%&'] | PEReference | Reference)* "'"
[68]   	EntityRef	   ::=   	'&' Name ';'
[69]   	PEReference	   ::=   	'%' Name ';'
*/
SAXScanner.prototype.scanEntityValue = function() {
    if (this.ch === '"' || this.ch === "'") {
        var quote = this.ch;
        this.nextChar(true);
        var entityValue = this.nextCharRegExp(new RegExp("[" + quote + "%]"));
        //if found a "%" must replace it, EntityRef are not replaced here.
        while (this.ch === "%") {
            this.nextChar(true);
            var ref = this.scanPeRef();
            entityValue += ref;
            entityValue += this.nextCharRegExp(new RegExp("[" + quote + "%]"));
        }
        if (/\uFFFF/.test(entityValue)) {
            return this.saxEvents.fatalError("invalid entity declaration value, must not contain U+FFFF", this);
        }
        //current char is ending quote
        this.nextChar();
        return entityValue;
    } else {
        return this.saxEvents.error("invalid entity value declaration, must begin with a quote", this);
    }
};

/*
[69]   	PEReference	   ::=   	'%' Name ';'
for use in scanDoctypeDeclIntSubset where we need the original entityName, it may have already been parsed
*/
SAXScanner.prototype.scanPeRef = function(entityName) {
    try {
        if (entityName === undefined) {
            entityName = this.nextCharWhileNot(";");
            this.nextChar(true);
        }
        //tries to replace it by its value if declared internally in doctype declaration
        var replacement = this.parameterEntities[entityName];
        if (replacement) {
            return replacement;
        }
        this.saxEvents.fatalError("parameter entity reference : [" + entityName + "] has not been declared, no replacement found", this);
        return "";
    //adding a message in that case
    } catch(e) {
        if (e instanceof EndOfInputException) {
            return this.saxEvents.fatalError("document incomplete, parameter entity reference must end with ;", this);
        } else {
            throw e;
        }
    }
};

/*
[45]   	elementdecl	   ::=   	'<!ELEMENT' S  Name  S  contentspec  S? '>'
[46]   	contentspec	   ::=   	'EMPTY' | 'ANY' | Mixed | children
[51]    	Mixed	   ::=   	'(' S? '#PCDATA' (S? '|' S? Name)* S? ')*'
			| '(' S? '#PCDATA' S? ')'
[47]   	children	   ::=   	(choice | seq) ('?' | '*' | '+')?
*/
SAXScanner.prototype.scanElementDecl = function() {
    if (this.matchStr("ELEMENT")) {
        this.nextChar();
        var name = this.scanName();
        this.nextChar();
        /*
TODO
        The content model will consist of the string "EMPTY", the string "ANY", or a parenthesised group, optionally followed by an occurrence indicator. The model will be normalized so that all parameter entities are fully resolved and all whitespace is removed,and will include the enclosing parentheses. Other normalization (such as removing redundant parentheses or simplifying occurrence indicators) is at the discretion of the parser.
        */
        var model = this.nextCharWhileNot(">");
        this.saxEvents.elementDecl(name, model);
        return true;
    }
    return false;
};

/*
[52]   	AttlistDecl	   ::=   	'<!ATTLIST' S  Name  AttDef* S? '>'
*/
SAXScanner.prototype.scanAttlistDecl = function() {
    if (this.matchStr("ATTLIST")) {
        this.nextChar();
        var eName = this.scanName();
        this.nextChar();
        while (this.ch !== ">") {
            this.scanAttDef(eName);
        }
        return true;
    }
    return false;
};

/*
[53]   	AttDef	   ::=   	S Name S AttType S DefaultDecl
[60]   	DefaultDecl	   ::=   	'#REQUIRED' | '#IMPLIED'
			| (('#FIXED' S)? AttValue)
[10]    	AttValue	   ::=   	'"' ([^<&"] | Reference)* '"'
                                |  "'" ([^<&'] | Reference)* "'"
ending char is the one before '>'
*/
SAXScanner.prototype.scanAttDef = function(eName) {
    var aName = this.scanName();
    this.nextChar();
    var type = this.scanAttType();
    this.nextChar();
    //DefaultDecl
    var mode = null;
    if (this.ch === "#") {
        mode = this.nextCharRegExp(new RegExp(WS_CHAR+"|>"));
        this.nextChar();
    }
    var attValue = null;
    if (mode === null || mode === "#FIXED") {
        //attValue
        //here % is included and parsed
        if (this.ch === "%") {
            this.includeParameterEntity();
        }
        if (this.ch === '"' || this.ch === "'") {
            var quote = this.ch;
            this.nextChar(true);
            attValue = this.nextCharRegExp(new RegExp("[" + quote + "<%]"));
            //if found a "%" must replace it, PeRef are replaced here but not EntityRef
            // Included in Literal here (not parsed as the literal can not be terminated by quote)
            while (this.ch === "%") {
                this.nextChar(true);
                var ref = this.scanPeRef();
                attValue += ref;
                attValue += this.nextCharRegExp(new RegExp("[" + quote + "<%]"));
            }
            if (this.ch === "<") {
                this.saxEvents.fatalError("invalid attribute value, must not contain &lt;", this);
            }
        }
    }
    this.saxEvents.attributeDecl(eName, aName, type, mode, attValue);
};

/*
[54]   	AttType	   ::=   	 StringType | TokenizedType | EnumeratedType
[55]   	StringType	   ::=   	'CDATA'
[56]   	TokenizedType	   ::=   	'ID'	[VC: ID]
			| 'IDREF'	[VC: IDREF]
			| 'IDREFS'	[VC: IDREF]
			| 'ENTITY'	[VC: Entity Name]
			| 'ENTITIES'	[VC: Entity Name]
			| 'NMTOKEN'	[VC: Name Token]
			| 'NMTOKENS'	[VC: Name Token]
[57]   	EnumeratedType	   ::=   	 NotationType | Enumeration
[58]   	NotationType	   ::=   	'NOTATION' S '(' S? Name (S? '|' S? Name)* S? ')'
[59]   	Enumeration	   ::=   	'(' S? Nmtoken (S? '|' S? Nmtoken)* S? ')'
[7]   	           Nmtoken	   ::=   	(NameChar)+
*/
SAXScanner.prototype.scanAttType = function() {
    var type;
    //Enumeration
    if (this.ch === "(") {
        this.nextChar();
        type = this.nextCharRegExp(NOT_START_OR_END_CHAR);
        //removes whitespaces between NOTATION, does not support the invalidity of whitespaces inside Name
        while (this.ch.search(WS) !== -1) {
            this.skipWhiteSpaces();
            type += this.nextCharRegExp(NOT_START_OR_END_CHAR);
            this.nextChar(true);
        }
        if (this.ch !== ")") {
            this.saxEvents.error("Invalid character : [" + this.ch + "] in ATTLIST enumeration", this);
            type += this.nextCharRegExp(WS);
        }
        type = "(" + type + ")";
    //NotationType
    } else if (this.matchStr("NOTATION")) {
        this.nextChar();
        if (this.ch === "(") {
            this.nextChar();
            type = this.scanName();
            this.nextChar();
            if (this.ch !== ")") {
                this.saxEvents.error("Invalid character : [" + this.ch + "] in ATTLIST enumeration", this);
            }
            this.nextChar();
        } else {
            this.saxEvents.error("Invalid NOTATION, must be followed by '('", this);
            this.nextCharWhileNot(">");
        }
        type = "NOTATION (" + type + ")";
    // StringType | TokenizedType
    } else {
        type = this.nextCharRegExp(WS);
        if (!/^CDATA$|^ID$|^IDREF$|^IDREFS$|^ENTITY$|^ENTITIES$|^NMTOKEN$|^NMTOKENS$/.test(type)) {
            this.saxEvents.error("Invalid type : [" + type + "] defined in ATTLIST", this);
        }
    }
    return type;
};

/*
[82]   	NotationDecl	   ::=   	'<!NOTATION' S  Name  S (ExternalID | PublicID) S? '>'
[83]   	PublicID	   ::=   	'PUBLIC' S  PubidLiteral
*/
SAXScanner.prototype.scanNotationDecl = function() {
    if (this.matchStr("NOTATION")) {
        this.nextChar();
        var name = this.scanName();
        this.nextChar();
        var externalId = new ExternalId();
        // here there may be only PubidLiteral after PUBLIC so can not use directly scanExternalId
        if (this.matchStr("PUBLIC")) {
            this.nextChar();
            externalId.publicId = this.scanPubIdLiteral();
            this.skipWhiteSpaces();
            if (this.ch !== ">") {
                externalId.systemId = this.scanSystemLiteral();
                this.skipWhiteSpaces();
            }
        } else {
            this.scanExternalId(externalId);
        }
        this.saxEvents.notationDecl(name, externalId.publicId, externalId.systemId);
        return true;
    }
    return false;
};

/*
if called from an element parsing defaultPrefix would be ""
if called from an attribute parsing defaultPrefix would be null

[39] element ::= EmptyElemTag | STag content ETag
[44] EmptyElemTag ::= '<' Name (S Attribute)* S? '/>'
[40] STag ::= '<' Name (S Attribute)* S? '>'
[41] Attribute ::= Name Eq AttValue
[10] AttValue ::= '"' ([^<&"] | Reference)* '"' | "'" ([^<&'] | Reference)* "'"
[67] Reference ::= EntityRef | CharRef
[68] EntityRef ::= '&' Name ';'
[66] CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
[43] content ::= (element | CharData | Reference | CDSect | PI | Comment)*
[42] ETag ::= '</' Name S? '>'
[4]  NameChar ::= Letter | Digit | '.' | '-' | '_' | ':' | CombiningChar | Extender
[5]  Name ::= Letter | '_' | ':') (NameChar)*
*/
SAXScanner.prototype.scanQName = function(defaultPrefix) {
    var name = this.scanName();
    var localName = name;
    if (name.indexOf(":") !== -1) {
        var splitResult = name.split(":");
        defaultPrefix = splitResult[0];
        localName = splitResult[1];
    }
    return new Sax_QName(defaultPrefix, localName);
};

SAXScanner.prototype.scanElement = function() {
    var qName = this.scanQName("");
    this.elementsStack.push(qName.qName);
    this.nextChar();
    var atts = this.scanAttributes(qName);
    var namespaceURI = null;
    try {
        namespaceURI = this.namespaceSupport.getURI(qName.prefix);
    } catch(e) {
        //should be a PrefixNotFoundException but not specified so no hypothesis
        this.saxEvents.error("namespace of element : [" + qName.qName + "] not found", this);
    }
    this.saxEvents.startElement(namespaceURI, qName.localName, qName.qName, atts);
    if (this.ch === "/") {
        this.nextChar(true);
        if (this.ch === ">") {
            this.elementsStack.pop();
            this.endMarkup(namespaceURI, qName);
        } else {
            this.saxEvents.fatalError("invalid empty markup, must finish with /&gt;", this);
        }
    }
    if (this.ch !== ">") {
        this.saxEvents.fatalError("invalid element, must finish with &gt;", this);
    }
    return true;
};

SAXScanner.prototype.scanAttributes = function(qName) {
    var atts = this.saxParser.getAttributesInstance();
    //namespaces declared at this step will be stored at one level of global this.namespaces
    this.namespaceSupport.pushContext();
    //same way, in all cases a baseUriAddition is recorded on each level
    var baseUriAddition = "";
    this.scanAttribute(qName, atts);
    //as namespaces are defined only after parsing all the attributes, adds the namespaceURI here
    var i = atts.getLength();
    while (i--) {
        var prefix = atts.getPrefix(i);
        var namespaceURI = null;
        try {
            namespaceURI = this.namespaceSupport.getURI(prefix);
        } catch(e) {
            this.saxEvents.error("namespace of attribute : [" + qName.qName + "] not found", this);
        }
        atts.setURI(i, namespaceURI);
        //handling special xml: attributes
        if (namespaceURI === NamespaceSupport.XMLNS) {
            switch (atts.getLocalName(i)) {
                case "base":
                    baseUriAddition = atts.getValue(i);
                    break;
                default:
                    break;
            }
        }
    }
    this.relativeBaseUris.push(baseUriAddition);
    return atts;
};

SAXScanner.prototype.scanAttribute = function(qName, atts) {
    this.skipWhiteSpaces();
    if (this.ch !== ">" && this.ch !== "/") {
        var attQName = this.scanQName(null);
        this.nextChar();
        if (this.ch === "=") {
            this.nextChar();
            var value = this.scanAttValue();
            if (attQName.prefix === "xmlns") {
                this.namespaceSupport.declarePrefix(attQName.localName, value);
                this.saxEvents.startPrefixMapping(attQName.localName, value);
            } else if (attQName.qName === "xmlns") {
                this.namespaceSupport.declarePrefix("", value);
                this.saxEvents.startPrefixMapping("", value);
            } else {
                //check that an attribute with the same qName has not already been defined
                if (atts.getIndex(attQName.qName) !== -1) {
                    this.saxEvents.error("multiple declarations for same attribute : [" + attQName.qName + "]", this);
                } else {
                    //we do not know yet the namespace URI, added when all attributes have been parser, and the type which is added at augmentation by SAXParser
                    atts.addAttribute(undefined, attQName.localName, attQName.qName, undefined, value);
                }
            }
            this.scanAttribute(qName, atts);
        } else {
            this.saxEvents.fatalError("invalid attribute, must contain = between name and value", this);
        }
    }
};

// [10] AttValue ::= '"' ([^<&"] | Reference)* '"' | "'" ([^<&'] | Reference)* "'"
SAXScanner.prototype.scanAttValue = function() {
    var attValue;
    if (this.ch === '"' || this.ch === "'") {
        var quote = this.ch;
        try {
            this.nextChar(true);
            if (this.ch === "&" || this.ch === quote) {
                attValue = "";
            } else {
                attValue = this.nextCharRegExp(new RegExp("[" + quote + "<&\uFFFF]"));
                this.nextChar(true);
            }
            //if found a "&"
            while (this.ch === "&") {
                this.nextChar(true);
                try {
                    this.scanRef();
                } catch (e2) {
                    if (e2 instanceof InternalEntityNotFoundException) {
                        this.saxEvents.error("entity reference : [" + e2.entityName + "] not declared, ignoring it", this);
                    } else if (e2 instanceof EntityNotReplacedException) {
                        attValue += "&" + e2.entityName + ";";
                    } else {
                        throw e2;
                    }
                }
                attValue += this.nextCharRegExp(new RegExp("[" + quote + "<&]"));
                this.nextChar(true);
            }
            if (this.ch === "<") {
                return this.saxEvents.fatalError("invalid attribute value, must not contain &lt;", this);
            }
            if (this.ch === '\uFFFF') {
                return this.saxEvents.fatalError("invalid attribute value, must not contain U+FFFF", this);
            }
            //current char is ending quote
            this.nextChar(true);
            if (/[^\/>"]/.test(this.ch) && this.ch.search(WS) === -1) { // Extra double-quote and premature slash errors handled elsewhere
                this.saxEvents.fatalError("Whitespace is required between attribute-value pairs.", this);
            }
            this.skipWhiteSpaces();
        //adding a message in that case
        } catch(e) {
            if (e instanceof EndOfInputException) {
                return this.saxEvents.fatalError("document incomplete, attribute value declaration must end with a quote", this);
            } else {
                throw e;
            }
        }
        return attValue;
    } else {
        return this.saxEvents.fatalError("invalid attribute value declaration, must begin with a quote", this);
    }
};

// [18]   	CDSect	   ::=   	 CDStart  CData  CDEnd
// [19]   	CDStart	   ::=   	'<![CDATA['
// [20]   	CData	   ::=   	(Char* - (Char* ']]>' Char*))
// [21]   	CDEnd	   ::=   	']]>'
/*
beginning char is <
ending char is after ]]>
*/
SAXScanner.prototype.scanCData = function() {
    if (this.matchStr("[CDATA[")) {
        this.saxEvents.startCDATA();
        this.nextChar(true);
        var cdata = "";
        while (!(this.matchStr("]]>"))) {
            //current char is included in cdata, no need to be tested
            cdata += this.nextCharWhileNot("]");
            //current char is last before ]
            this.nextChar(true);
        }
        if (/\uFFFF/.test(cdata)) {
            this.saxEvents.fatalError("Character U+FFFF is not allowed within CDATA.", this);
        }
        this.saxEvents.characters(cdata, 0, cdata.length);
        this.saxEvents.endCDATA();
        return true;
    } else {
        return false;
    }
};

// [66] CharRef ::= '&#' [0-9]+ ';' | '&#x' [0-9a-fA-F]+ ';'
// current ch is char after "&#",  returned current char is after ";"
SAXScanner.prototype.scanCharRef = function() {
    var replacement, charCode = "";
    if (this.ch === "x") {
        this.nextChar(true);
        while (this.ch !== ";") {
            if (!/[0-9a-fA-F]/.test(this.ch)) {
                this.saxEvents.error("invalid char reference beginning with x, must contain alphanumeric characters only", this);
            } else {
                charCode += this.ch;
            }
            this.nextChar(true);
        }
        this.nextChar(true);
        if (this.saxParser.features['http://debeissat.nicolas.free.fr/ns/canonicalize-entities-and-character-references']) {
            replacement = String.fromCharCode("0x" + charCode);
            this.includeText(replacement);
        }
        if (this.saxEvents.startCharacterReference) {
            this.saxEvents.startCharacterReference(true, charCode);
        }
    } else {
        while (this.ch !== ";") {
            if (!/\d/.test(this.ch)) {
                this.saxEvents.error("invalid char reference, must contain numeric characters only", this);
            } else {
                charCode += this.ch;
            }
            this.nextChar(true);
        }
        this.nextChar(true);
        if (this.saxParser.features['http://debeissat.nicolas.free.fr/ns/canonicalize-entities-and-character-references']) {
            replacement = String.fromCharCode(charCode);
            this.includeText(replacement);
        }
        if (this.saxEvents.startCharacterReference) {
            this.saxEvents.startCharacterReference(false, charCode);
        }
    }
};

/*
[68]  EntityRef ::= '&' Name ';'
may return undefined, has to be managed differently depending on
*/
SAXScanner.prototype.scanEntityRef = function() {
    try {
        var entityName = this.scanName();
        this.nextChar(true);
        //current char must be ';'
        if (this.ch !== ";") {
            this.saxEvents.error("entity : [" + entityName + "] contains an invalid character : [" + this.ch + "], or it is not ended by ;", this);
            return "";
        }
        this.saxEvents.startEntity(entityName);
        this.saxEvents.endEntity(entityName);
        // well-formed documents need not declare any of the following entities: amp, lt, gt, quot.
        if (entityName.search(NOT_REPLACED_ENTITIES) !== -1) {
            throw new EntityNotReplacedException(entityName);
        }
        //apos is replaced by '
        if (entityName.search(APOS_ENTITY) !== -1) {
            this.includeText("'");
        } else {
            var replacement = this.entities[entityName];
            if (replacement === undefined) {
                throw new InternalEntityNotFoundException(entityName);
            }
            this.includeEntity(entityName, replacement);
        }
    //adding a message in that case
    } catch(e) {
        if (e instanceof EndOfInputException) {
            return this.saxEvents.fatalError("document incomplete, entity reference must end with ;", this);
        } else {
            throw e;
        }
    }
};

// [42] ETag ::= '</' Name S? '>'
SAXScanner.prototype.scanEndingTag = function() {
    var qName = this.scanQName("");
    var namespaceURI = null;
    try {
        namespaceURI = this.namespaceSupport.getURI(qName.prefix);
    } catch(e) {
        this.saxEvents.error("namespace of ending tag : [" + qName.qName + "] not found", this);
    }
    var currentElement = this.elementsStack.pop();
    if (qName.qName === currentElement) {
        this.nextChar();
        if (this.ch === ">") {
            this.endMarkup(namespaceURI, qName);
            return true;
        } else {
            return this.saxEvents.fatalError("invalid ending markup, does not finish with &gt;", this);
        }
    } else {
        return this.saxEvents.fatalError("invalid ending markup : [" + qName.qName + "], markup name does not match current one : [" + currentElement + "]", this);
    }
};


SAXScanner.prototype.endMarkup = function(namespaceURI, qName) {
    this.saxEvents.endElement(namespaceURI, qName.localName, qName.qName);
    var namespacesRemoved = this.namespaceSupport.popContext();
    for (var i in namespacesRemoved) {
        this.saxEvents.endPrefixMapping(i);
    }
    this.relativeBaseUris.pop();
};

/*
[4]   	NameStartChar	   ::=   	":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
[4a]   	NameChar	   ::=   	NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
[5]   	Name	   ::=   	NameStartChar (NameChar)*
*/
SAXScanner.prototype.scanName = function() {
    if (this.ch.search(NOT_START_CHAR) !== -1) {
        this.saxEvents.fatalError("invalid starting character in Name : [" + this.ch + "]", this);
        return "";
    }
    var name = this.nextCharRegExp(NOT_START_OR_END_CHAR);
    return name;
};

/******************READING API************************/

/*
if dontSkipWhiteSpace is not passed, then it is false so skipWhiteSpaces is default
if end of document, char is ''
*/
SAXScanner.prototype.nextChar = function(dontSkipWhiteSpace) {
    this.ch = this.reader.next();
    if (!dontSkipWhiteSpace) {
        this.skipWhiteSpaces();
    }
};

SAXScanner.prototype.skipWhiteSpaces = function() {
    while (this.ch.search(WS) !== -1) {
        this.ch = this.reader.next();
    }
};

/*
current char is not tested as it is not possible to go back in Reader
to respect ending char rule :
ending char is the last matching the regexp
*/
SAXScanner.prototype.nextCharRegExp = function(regExp, continuation) {
    var returned = this.ch;
    var currChar = this.reader.peek();
    while (true) {
        if (currChar.search(regExp) !== -1) {
            if (continuation && currChar.search(continuation.pattern) !== -1) {
                var cb = continuation.cb.call(this);
                if (cb !== true) {
                    return cb;
                }
                returned += currChar;
                currChar = this.reader.peek();
                continue;
            }
            return returned;
        } else {
            returned += currChar;
            //consumes actual char
            this.ch = this.reader.next();
            currChar = this.reader.peek();
        }
    }
};

/*
same as above but with a char not a regexp and no continuation
best for performance
*/
SAXScanner.prototype.nextCharWhileNot = function(ch) {
    var returned = this.ch;
    var currChar = this.reader.peek();
    while (currChar !== ch) {
        returned += currChar;
        this.ch = this.reader.next();
        currChar = this.reader.peek();
    }
    return returned;
}

/*
if current char + next length - 1 chars match regexp
current char is first of regexp
ending char is the last matching the regexp 
*/
SAXScanner.prototype.matchRegExp = function(l, regExp) {
    var len = l - 1;
    var follow = this.ch + this.reader.peekLen(len);
    if (follow.search(regExp) === 0) {
        this.reader.skip(len);
        this.ch = follow.charAt(len);
        return true;
    }
    return false;
    
}

/*
if current char + next length - 1 chars match str
current char is first of str
ending char is the last matching the str or stay at current char 
*/
SAXScanner.prototype.matchStr = function(str) {
    var len = str.length - 1;
    var follow = this.ch;
    if (len > 0) {
        follow += this.reader.peekLen(len);
    }
    if (follow === str) {
        this.reader.skip(len);
        this.ch = follow.charAt(len);
        return true;
    }
    return false;
};

/*
if next char is ch
consumes current char if true, so ending char is the one taken in argument
*/
SAXScanner.prototype.isFollowedByCh = function(ch) {
   var nextChar = this.reader.peek();
   if (nextChar === ch) {
       this.ch = this.reader.next();
       return true;
   }
   return false;
}
/*
current char is opening ' or "
ending char is quote
*/
SAXScanner.prototype.quoteContent = function() {
    var content, quote = this.ch;
    this.nextChar(true);
    if (this.ch !== quote) {
        content = this.nextCharWhileNot(quote);
    } else {
        content = "";
    }
    this.nextChar(true);
    return content;
};


this.SAXScanner = SAXScanner;
this.EndOfInputException = EndOfInputException;

}()); // end namespace
