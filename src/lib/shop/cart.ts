export type Product={id:string;name:string;unit:'g'|'ml'|'piece';step:number;pricePaise:number;priceQuantity:number;stock:number};
// Fictional demo catalog. These are not merchant quotes or live inventory.
const rows:[string,string,Product['unit'],number,number,number][]=[
 ['rice','चावल','g',250,6000,1000],['atta','आटा','g',500,4500,1000],['sugar','चीनी','g',250,4800,1000],['salt','नमक','piece',1,2500,1],['milk','दूध','ml',500,6000,1000],['curd','दही','g',250,9000,1000],['toor','अरहर दाल','g',250,15000,1000],['moong','मूंग दाल','g',250,13000,1000],['chana','चना','g',250,10000,1000],['oil','तेल','ml',500,14000,1000],['tea','चाय','g',100,40000,1000],['coffee','कॉफ़ी','g',100,60000,1000],['soap','साबुन','piece',1,3500,1],['detergent','डिटर्जेंट','piece',1,8000,1],['biscuits','बिस्कुट','piece',1,2000,1],['bread','ब्रेड','piece',1,4000,1],['oats','ओट्स','g',500,16000,1000],['poha','पोहा','g',500,7000,1000],['suji','सूजी','g',500,6000,1000],['besan','बेसन','g',500,10000,1000],['haldi','हल्दी','g',100,30000,1000],['mirchi','मिर्च','g',100,35000,1000],['cumin','जीरा','g',100,60000,1000],['toothpaste','टूथपेस्ट','piece',1,6500,1],['tissue','टिश्यू','piece',1,5000,1]
];
export const catalog:ReadonlyArray<Product>=rows.map(([id,name,unit,step,pricePaise,priceQuantity])=>Object.freeze({id,name,unit,step,pricePaise,priceQuantity,stock:unit==='piece'?20:10000}));
export type Cart={revision:number;lines:{productId:string;quantity:number}[];intents:Record<string,string>};
export type CartChange={key:string;revision:number;productId:string;quantity:number;unit:string};
export const emptyCart=():Cart=>({revision:0,lines:[],intents:{}});
export function changeCart(cart:Cart,action:CartChange):Cart{
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(action.key))throw Error('Invalid idempotency key');
 const fingerprint=JSON.stringify([action.revision,action.productId,action.quantity,action.unit]);
 if(Object.hasOwn(cart.intents,action.key)){if(cart.intents[action.key]!==fingerprint)throw Error('idempotency key reused');return cart;}
 if(!Number.isSafeInteger(action.revision)||action.revision!==cart.revision)throw Error('Stale cart revision');
 const product=catalog.find(p=>p.id===action.productId);if(!product)throw Error('Unknown product; clarify request');
 if(action.unit!==product.unit)throw Error('Invalid unit; clarify request');
 if(!Number.isSafeInteger(action.quantity)||action.quantity<0||action.quantity%product.step!==0)throw Error('Invalid quantity');
 if(action.quantity>product.stock)throw Error('Insufficient stock');
 if(Object.keys(cart.intents).length>=1000)throw Error('Cart mutation limit reached');
 const lines=cart.lines.filter(line=>line.productId!==product.id);
 if(action.quantity)lines.push({productId:product.id,quantity:action.quantity});
 return {revision:cart.revision+1,lines,intents:{...cart.intents,[action.key]:fingerprint}};
}
export function cartTotal(cart:Cart){return cart.lines.reduce((sum,line)=>{const p=catalog.find(p=>p.id===line.productId);if(!p)throw Error('Invalid stored product');return sum+Math.round(p.pricePaise*line.quantity/p.priceQuantity);},0);}
