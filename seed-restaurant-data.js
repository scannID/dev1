// Seed script to create a test restaurant with menu items
// Run this in browser console while on http://localhost:5173

const restaurantData = {
  id: 'bella-pizza-001',
  name: 'Bella Pizza Restaurant',
  type: 'restaurant',
  description: 'Authentic Italian pizza and pasta',
  items: [
    // Pizzas
    {
      id: 'bella-pizza-001-pizza-1',
      name: 'Margherita Pizza',
      category: 'Pizzas',
      price: 25000,
      description: 'Fresh mozzarella, tomato sauce, basil',
      available: true
    },
    {
      id: 'bella-pizza-001-pizza-2',
      name: 'Pepperoni Pizza',
      category: 'Pizzas',
      price: 30000,
      description: 'Pepperoni, mozzarella, tomato sauce',
      available: true
    },
    {
      id: 'bella-pizza-001-pizza-3',
      name: 'Quattro Formaggi',
      category: 'Pizzas',
      price: 35000,
      description: 'Four cheese blend: mozzarella, gorgonzola, parmesan, ricotta',
      available: true
    },
    {
      id: 'bella-pizza-001-pizza-4',
      name: 'Hawaiian Pizza',
      category: 'Pizzas',
      price: 28000,
      description: 'Ham, pineapple, mozzarella',
      available: true
    },
    
    // Pasta
    {
      id: 'bella-pizza-001-pasta-1',
      name: 'Spaghetti Carbonara',
      category: 'Pasta',
      price: 22000,
      description: 'Creamy sauce with bacon and parmesan',
      available: true
    },
    {
      id: 'bella-pizza-001-pasta-2',
      name: 'Fettuccine Alfredo',
      category: 'Pasta',
      price: 24000,
      description: 'Rich cream sauce with parmesan',
      available: true
    },
    {
      id: 'bella-pizza-001-pasta-3',
      name: 'Penne Arrabbiata',
      category: 'Pasta',
      price: 20000,
      description: 'Spicy tomato sauce with garlic',
      available: true
    },
    
    // Drinks
    {
      id: 'bella-pizza-001-drink-1',
      name: 'Coca Cola',
      category: 'Drinks',
      price: 3000,
      description: 'Chilled soft drink',
      available: true
    },
    {
      id: 'bella-pizza-001-drink-2',
      name: 'Fresh Orange Juice',
      category: 'Drinks',
      price: 5000,
      description: 'Freshly squeezed',
      available: true
    },
    {
      id: 'bella-pizza-001-drink-3',
      name: 'Italian Lemonade',
      category: 'Drinks',
      price: 4000,
      description: 'Homemade with fresh lemons',
      available: true
    },
    
    // Appetizers
    {
      id: 'bella-pizza-001-app-1',
      name: 'Bruschetta',
      category: 'Appetizers',
      price: 8000,
      description: 'Toasted bread with tomatoes, garlic, and olive oil',
      available: true
    },
    {
      id: 'bella-pizza-001-app-2',
      name: 'Mozzarella Sticks',
      category: 'Appetizers',
      price: 12000,
      description: 'Fried mozzarella with marinara sauce',
      available: true
    },
    {
      id: 'bella-pizza-001-app-3',
      name: 'Caesar Salad',
      category: 'Appetizers',
      price: 15000,
      description: 'Romaine lettuce, croutons, parmesan, caesar dressing',
      available: true
    },
    
    // Desserts
    {
      id: 'bella-pizza-001-dessert-1',
      name: 'Tiramisu',
      category: 'Desserts',
      price: 10000,
      description: 'Classic Italian coffee-flavored dessert',
      available: true
    },
    {
      id: 'bella-pizza-001-dessert-2',
      name: 'Gelato',
      category: 'Desserts',
      price: 7000,
      description: 'Italian ice cream - vanilla, chocolate, or strawberry',
      available: true
    }
  ]
};

// Function to seed the data
function seedRestaurant() {
  try {
    // Get existing businesses from localStorage
    const existingData = localStorage.getItem('scanny-businesses-v2');
    let businesses = existingData ? JSON.parse(existingData) : [];
    
    // Check if restaurant already exists
    const existingIndex = businesses.findIndex(b => b.id === restaurantData.id);
    
    if (existingIndex >= 0) {
      // Update existing
      businesses[existingIndex] = restaurantData;
      console.log('✅ Restaurant updated!');
    } else {
      // Add new
      businesses.push(restaurantData);
      console.log('✅ Restaurant added!');
    }
    
    // Save to localStorage
    localStorage.setItem('scanny-businesses-v2', JSON.stringify(businesses));
    
    console.log('🍕 Bella Pizza Restaurant created with', restaurantData.items.length, 'menu items');
    console.log('📱 Customer menu URL:', `http://localhost:5173/?bid=${restaurantData.id}`);
    console.log('🔄 Refresh the page to see changes');
    
    return restaurantData;
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }
}

// Run it!
seedRestaurant();
