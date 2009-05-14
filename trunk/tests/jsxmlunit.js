/*global assertEquals, data_of, assertTrue, is_ignorable  */
/*
Copyright or � or Copr. Nicolas Debeissat

nicolas.debeissat@gmail.com (http://debeissat.nicolas.free.fr/)

This software is a computer program whose purpose is to validate XML
against a RelaxNG schema.

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

function assertAttributesEquals(attsExpected, attsResult) {
    var i, j;
    for (i = 0 ; i < attsExpected.length ; i++) {
        var attExpected = attsExpected.item(i);
        var attFound = false;
        for (j = 0 ; j < attsResult.length && !attFound; j++) {
            var attResult = attsResult.item(j);
            if (attResult.nodeName === attExpected.nodeName) {
                attFound = true;
                assertEquals("invalid value of attribute " + attResult.nodeName, attExpected.value, attResult.value);
            }
        }
        assertTrue("missing attribute " + attExpected.nodeName, attFound);
    }
}

function assertXmlEquals(expected, result) {
    var i;
    assertEquals("different nodes types", expected.nodeType, result.nodeType);
    switch(expected.nodeType) {
        case 1: //element nodes
            assertEquals("different node names", expected.nodeName, result.nodeName);
            var attsExpected = expected.attributes;
            var attsResult = result.attributes;
            //remove namespaces declaration from attributes, not supported
            for (i = 0 ; i < attsExpected.length ; i++) {
                var attExpected = attsExpected.item(i);
                if (/^xmlns/.test(attExpected.nodeName)) {
                    expected.removeAttributeNode(attExpected);
                    i--;
                }
            }
            for (i = 0 ; i < attsResult.length ; i++) {
                var attResult = attsResult.item(i);
                if (/^xmlns/.test(attResult.nodeName)) {
                    result.removeAttributeNode(attResult);
                    i--;
                }
            }
            assertEquals("different number of attributes on node " + result.nodeName, attsExpected.length, attsResult.length);
            assertAttributesEquals(attsExpected, attsResult);
            var childNodesExpected = expected.childNodes;
            var childNodesResult = result.childNodes;
            //remove ignorables child nodes
            for (i = 0 ; i < childNodesExpected.length ; i++) {
                var childNodeExpected = childNodesExpected.item(i);
                if (is_ignorable(childNodeExpected)) {
                    expected.removeChild(childNodeExpected);
                    i--;
                }
            }
            for (i = 0 ; i < childNodesResult.length ; i++) {
                var childNodeResult = childNodesResult.item(i);
                if (is_ignorable(childNodeResult)) {
                    result.removeChild(childNodeResult);
                    i--;
                }
            }
            assertEquals("different number of children nodes under " + result.nodeName, childNodesExpected.length, childNodesResult.length);
            for (i = 0 ; i < childNodesExpected.length ; i++) {
                assertXmlEquals(childNodesExpected.item(i), childNodesResult.item(i));
            }
            break;
        case 3: //text nodes
            assertEquals("different text content", data_of(expected), data_of(result));
            break;
        case 4: //CDATA nodes
            assertEquals("different content in CDATA", data_of(expected), data_of(result));
            break;
        case 8: //comment nodes
            assertEquals("different content of comment", data_of(expected), data_of(result));
            break;
        case 9: //document
            var expectedDocument = expected.documentElement;
            var resultDocument = result.documentElement;
            //firefox splits long text nodes for example.
            expectedDocument.normalize();
            resultDocument.normalize();
            assertXmlEquals(expectedDocument, resultDocument);
            break;
        // Fix: Need test cases for the following node types (at least the ones implemented)
        case 2: // attribute node
        case 5: // entity reference node
        case 6: // entity node
        case 7: // processing instruction node
        case 10: // document type node
        case 11: // document fragment node
        case 12: // notation node
        default:
            throw 'Node type not supported in jsxmlunit test';
            break;
    }
}
