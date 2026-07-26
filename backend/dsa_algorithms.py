from typing import List, Dict, Any

class TrieNode:
    def __init__(self):
        self.children: Dict[str, 'TrieNode'] = {}
        self.is_end_of_word: bool = False
        self.metadata: Any = None  # To store associated data like full object, hsn code, price etc.

class AutoCompleteTrie:
    """
    A custom Trie (Prefix Tree) implementation to demonstrate DSA skills.
    This provides O(L) time complexity for search, where L is the length of the prefix.
    """
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str, metadata: Any = None):
        if not word:
            return
        
        # Convert to lowercase for case-insensitive search
        word = word.lower()
        node = self.root
        
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
            
        self.is_end_of_word = True
        node.metadata = metadata

    def _dfs_collect(self, node: TrieNode, prefix: str, results: List[Dict], limit: int):
        if len(results) >= limit:
            return
            
        if node.metadata is not None:
            results.append({"word": prefix, "data": node.metadata})
            
        # Traverse children alphabetically
        for char, child_node in sorted(node.children.items()):
            self._dfs_collect(child_node, prefix + char, results, limit)

    def search_prefix(self, prefix: str, limit: int = 5) -> List[Dict]:
        """
        Finds all words in the trie that start with the given prefix.
        Returns a list of dictionaries containing the full word and associated metadata.
        """
        results = []
        if not prefix:
            return results
            
        prefix_lower = prefix.lower()
        node = self.root
        
        # Find the node representing the end of the prefix
        for char in prefix_lower:
            if char not in node.children:
                return results  # Prefix not found
            node = node.children[char]
            
        # Collect all words originating from this prefix node
        self._dfs_collect(node, prefix_lower, results, limit)
        return results

# Initialize some sample data into the Trie for demonstration
product_trie = AutoCompleteTrie()

sample_products = [
    {"name": "Handwoven Bamboo Basket", "price": 450, "hsn_code": "46021990"},
    {"name": "Decorative Ceramic Vase", "price": 1200, "hsn_code": "69139000"},
    {"name": "Brass Traditional Lamp", "price": 2500, "hsn_code": "74199930"},
    {"name": "Jute Wall Hanging", "price": 850, "hsn_code": "63049200"},
    {"name": "Wooden Serving Tray", "price": 600, "hsn_code": "44190020"},
    {"name": "Handpainted Terracotta Pots", "price": 350, "hsn_code": "69149000"},
    {"name": "Macrame Plant Hanger", "price": 299, "hsn_code": "56079090"}
]

for product in sample_products:
    product_trie.insert(product["name"], product)
