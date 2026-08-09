"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import {
    ArrowRight,
    ShoppingCart,
    Heart,
    Eye,
    Star,
    Truck,
    Shield,
    RefreshCw,
    X,
    Search,
    User,
    Zap,
    Percent,
    Clock,
    Check,
} from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";

gsap.registerPlugin(ScrollTrigger);

interface ThemeHomeProps {
    workspace: {
        id: string;
        name: string;
        slug: string;
        theme_id: string | null;
    };
    dictionary: Record<string, unknown>;
    locale: string;
}

interface Product {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    image: string;
    category: string;
    rating: number;
    reviews: number;
    badge?: "new" | "sale" | "bestseller";
}

interface QuickViewProduct extends Product {
    description: string;
    colors: string[];
    sizes: string[];
}

export function EcommerceHome({ dictionary }: ThemeHomeProps) {
    useTemplate();
    const heroRef = useRef<HTMLElement>(null);
    const [quickViewProduct, setQuickViewProduct] = useState<QuickViewProduct | null>(null);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [cartCount, setCartCount] = useState(0);

    // Hero animation
    useGSAP(
        () => {
            if (!heroRef.current) return;
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.fromTo("[data-ecom-banner]", { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8 })
                .fromTo("[data-ecom-title]", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.4")
                .fromTo("[data-ecom-subtitle]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.3")
                .fromTo("[data-ecom-cta]", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, "-=0.2")
                .fromTo("[data-ecom-image]", { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8 }, "-=0.6");
        },
        { scope: heroRef }
    );

    const dict = dictionary as Record<string, Record<string, string | string[] | Record<string, string>>>;
    const homeDict = (dict.home as Record<string, string | string[]>) || {};

    const categories = [
        { id: "all", label: "All Products" },
        { id: "clothing", label: "Clothing" },
        { id: "accessories", label: "Accessories" },
        { id: "electronics", label: "Electronics" },
        { id: "home", label: "Home & Living" },
    ];

    const featuredProducts: Product[] = [
        {
            id: "1",
            name: "Premium Wireless Headphones",
            price: 299,
            originalPrice: 399,
            image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80",
            category: "electronics",
            rating: 4.8,
            reviews: 234,
            badge: "sale",
        },
        {
            id: "2",
            name: "Minimalist Leather Watch",
            price: 189,
            image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80",
            category: "accessories",
            rating: 4.9,
            reviews: 156,
            badge: "bestseller",
        },
        {
            id: "3",
            name: "Organic Cotton T-Shirt",
            price: 49,
            image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80",
            category: "clothing",
            rating: 4.7,
            reviews: 89,
            badge: "new",
        },
        {
            id: "4",
            name: "Smart Home Speaker",
            price: 149,
            originalPrice: 199,
            image: "https://images.unsplash.com/photo-1543512214-318c7553f230?w=500&q=80",
            category: "electronics",
            rating: 4.6,
            reviews: 312,
            badge: "sale",
        },
        {
            id: "5",
            name: "Ceramic Plant Pot Set",
            price: 79,
            image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&q=80",
            category: "home",
            rating: 4.8,
            reviews: 67,
        },
        {
            id: "6",
            name: "Canvas Backpack",
            price: 129,
            image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80",
            category: "accessories",
            rating: 4.5,
            reviews: 198,
            badge: "bestseller",
        },
        {
            id: "7",
            name: "Wool Blend Sweater",
            price: 159,
            originalPrice: 199,
            image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=500&q=80",
            category: "clothing",
            rating: 4.7,
            reviews: 145,
            badge: "sale",
        },
        {
            id: "8",
            name: "Desk LED Lamp",
            price: 89,
            image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&q=80",
            category: "home",
            rating: 4.4,
            reviews: 76,
            badge: "new",
        },
    ];

    const quickViewData: QuickViewProduct = {
        id: "1",
        name: "Premium Wireless Headphones",
        price: 299,
        originalPrice: 399,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80",
        category: "electronics",
        rating: 4.8,
        reviews: 234,
        badge: "sale",
        description: "Experience premium sound quality with our wireless headphones. Features active noise cancellation, 30-hour battery life, and ultra-comfortable ear cushions.",
        colors: ["Black", "White", "Navy"],
        sizes: ["One Size"],
    };

    const filteredProducts = selectedCategory === "all" 
        ? featuredProducts 
        : featuredProducts.filter(p => p.category === selectedCategory);

    const addToCart = () => {
        setCartCount(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-white text-gray-900">
            {/* Top Banner */}
            <div className="bg-gray-900 text-white py-2.5 px-4">
                <div className="container mx-auto max-w-7xl flex items-center justify-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span>Free shipping on orders over $50 | Use code </span>
                    <span className="font-bold text-yellow-400">SAVE20</span>
                    <span> for 20% off</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="sticky top-0 z-40 bg-white border-b border-gray-100">
                <div className="container mx-auto max-w-7xl px-4">
                    <div className="flex items-center justify-between h-16">
                        <Link href="/" className="text-2xl font-bold tracking-tight">
                            {(homeDict.brandName as string) || "SHOP"}
                        </Link>
                        <div className="hidden md:flex items-center gap-8">
                            {["New Arrivals", "Best Sellers", "Sale", "Collections"].map((item) => (
                                <Link
                                    key={item}
                                    href="#"
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    {item}
                                </Link>
                            ))}
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <Search className="w-5 h-5" />
                            </button>
                            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <User className="w-5 h-5" />
                            </button>
                            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
                                <ShoppingCart className="w-5 h-5" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-r from-gray-50 to-white">
                <div className="container mx-auto max-w-7xl px-4 py-16 md:py-24">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <div data-ecom-banner className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-600 rounded-full text-sm font-medium mb-6">
                                <Percent className="w-4 h-4" />
                                Summer Sale - Up to 50% Off
                            </div>
                            <h1 data-ecom-title className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                                {(homeDict.title as string) || "Discover Your"}
                                <span className="block text-rose-500">
                                    {(homeDict.titleHighlight as string) || "Perfect Style"}
                                </span>
                            </h1>
                            <p data-ecom-subtitle className="text-lg text-gray-600 mb-8 max-w-lg">
                                {(homeDict.subtitle as string) ||
                                    "Shop the latest trends with free shipping and easy returns. Quality products, unbeatable prices."}
                            </p>
                            <div data-ecom-cta className="flex flex-col sm:flex-row gap-4">
                                <Button size="lg" className="bg-gray-900 hover:bg-gray-800 text-white px-8">
                                    Shop Now
                                    <ArrowRight className="ms-2 w-5 h-5" />
                                </Button>
                                <Button size="lg" variant="outline" className="border-gray-300 px-8">
                                    View Lookbook
                                </Button>
                            </div>
                        </div>
                        <div data-ecom-image className="relative">
                            <div className="aspect-square rounded-3xl overflow-hidden bg-gray-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80"
                                    alt="Featured collection"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Floating product card */}
                            <motion.div
                                className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 w-48"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&q=80"
                                            alt="Trending product"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500">Trending</div>
                                        <div className="font-semibold text-sm">2.5k+ sold</div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Badges */}
            <section className="py-8 border-y border-gray-100 bg-gray-50">
                <div className="container mx-auto max-w-7xl px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { icon: Truck, label: "Free Shipping", sublabel: "On orders over $50" },
                            { icon: RefreshCw, label: "Easy Returns", sublabel: "30-day return policy" },
                            { icon: Shield, label: "Secure Payment", sublabel: "100% secure checkout" },
                            { icon: Clock, label: "24/7 Support", sublabel: "Dedicated support team" },
                        ].map((badge, index) => (
                            <div key={index} className="flex items-center justify-center gap-3">
                                <badge.icon className="w-8 h-8 text-gray-400" />
                                <div>
                                    <div className="font-semibold text-sm">{badge.label}</div>
                                    <div className="text-xs text-gray-500">{badge.sublabel}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Categories */}
            <section className="py-16 px-4">
                <div className="container mx-auto max-w-7xl">
                    <ScrollReveal>
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold mb-4">Shop by Category</h2>
                            <p className="text-gray-600">Find exactly what you&apos;re looking for</p>
                        </div>
                    </ScrollReveal>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { name: "Clothing", image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&q=80", count: 245 },
                            { name: "Accessories", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80", count: 128 },
                            { name: "Electronics", image: "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=400&q=80", count: 89 },
                            { name: "Home & Living", image: "https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400&q=80", count: 167 },
                        ].map((category, index) => (
                            <motion.div
                                key={index}
                                whileHover={{ y: -8 }}
                                className="group cursor-pointer"
                            >
                                <div className="aspect-[3/4] rounded-2xl overflow-hidden relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={category.image}
                                        alt={category.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-4 left-4 text-white">
                                        <div className="font-semibold text-lg">{category.name}</div>
                                        <div className="text-sm text-white/70">{category.count} products</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Featured Products */}
            <section className="py-16 px-4 bg-gray-50">
                <div className="container mx-auto max-w-7xl">
                    <ScrollReveal>
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Featured Products</h2>
                                <p className="text-gray-600">Handpicked favorites just for you</p>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                            selectedCategory === category.id
                                                ? "bg-gray-900 text-white"
                                                : "bg-white text-gray-600 hover:bg-gray-100"
                                        }`}
                                    >
                                        {category.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </ScrollReveal>

                    <motion.div 
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                        layout
                    >
                        <AnimatePresence mode="popLayout">
                            {filteredProducts.map((product) => (
                                <motion.div
                                    key={product.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
                                    className="group"
                                >
                                    <Card className="border-0 shadow-none bg-transparent">
                                        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            {/* Badge */}
                                            {product.badge && (
                                                <div
                                                    className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${
                                                        product.badge === "sale"
                                                            ? "bg-rose-500 text-white"
                                                            : product.badge === "new"
                                                            ? "bg-emerald-500 text-white"
                                                            : "bg-gray-900 text-white"
                                                    }`}
                                                >
                                                    {product.badge === "sale"
                                                        ? "Sale"
                                                        : product.badge === "new"
                                                        ? "New"
                                                        : "Best Seller"}
                                                </div>
                                            )}
                                            {/* Quick Actions */}
                                            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
                                                    <Heart className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setQuickViewProduct(quickViewData)}
                                                    className="w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {/* Add to Cart */}
                                            <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0">
                                                <Button 
                                                    onClick={addToCart}
                                                    className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                                                >
                                                    <ShoppingCart className="w-4 h-4 me-2" />
                                                    Add to Cart
                                                </Button>
                                            </div>
                                        </div>
                                        <CardContent className="p-0">
                                            <div className="flex items-center gap-1 mb-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3.5 h-3.5 ${
                                                            i < Math.floor(product.rating)
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "fill-gray-200 text-gray-200"
                                                        }`}
                                                    />
                                                ))}
                                                <span className="text-xs text-gray-500 ms-1">
                                                    ({product.reviews})
                                                </span>
                                            </div>
                                            <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
                                                {product.name}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">${product.price}</span>
                                                {product.originalPrice && (
                                                    <span className="text-sm text-gray-400 line-through">
                                                        ${product.originalPrice}
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>

                    <div className="text-center mt-12">
                        <Button size="lg" variant="outline" className="px-8">
                            View All Products
                            <ArrowRight className="ms-2 w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* Sale Banner */}
            <section className="py-16 px-4">
                <div className="container mx-auto max-w-7xl">
                    <motion.div
                        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 to-orange-500 p-12 md:p-16"
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="relative z-10 max-w-xl">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white text-sm font-medium mb-6">
                                <Clock className="w-4 h-4" />
                                Limited Time Offer
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                Summer Flash Sale
                            </h2>
                            <p className="text-xl text-white/90 mb-8">
                                Get up to 50% off on selected items. Don&apos;t miss out on these incredible deals!
                            </p>
                            <Button size="lg" className="bg-white text-rose-600 hover:bg-white/90 px-8">
                                Shop the Sale
                                <ArrowRight className="ms-2 w-5 h-5" />
                            </Button>
                        </div>
                        {/* Decorative elements */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
                    </motion.div>
                </div>
            </section>

            {/* Newsletter */}
            <section className="py-16 px-4 bg-gray-900 text-white">
                <div className="container mx-auto max-w-3xl text-center">
                    <ScrollReveal>
                        <h2 className="text-3xl font-bold mb-4">Stay in the Loop</h2>
                        <p className="text-gray-400 mb-8">
                            Subscribe to our newsletter for exclusive offers, new arrivals, and style inspiration.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                            />
                            <Button className="bg-white text-gray-900 hover:bg-gray-100 px-6">
                                Subscribe
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-4">
                            By subscribing, you agree to our Privacy Policy and consent to receive updates.
                        </p>
                    </ScrollReveal>
                </div>
            </section>

            {/* Quick View Modal */}
            <AnimatePresence>
                {quickViewProduct && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                        onClick={() => setQuickViewProduct(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2">
                                <div className="aspect-square bg-gray-100">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={quickViewProduct.image}
                                        alt={quickViewProduct.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="p-8">
                                    <button
                                        onClick={() => setQuickViewProduct(null)}
                                        className="float-right p-2 hover:bg-gray-100 rounded-full"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                    <div className="flex items-center gap-2 mb-2">
                                        {quickViewProduct.badge && (
                                            <span className="px-2 py-1 bg-rose-100 text-rose-600 text-xs font-semibold rounded">
                                                {quickViewProduct.badge === "sale" ? "On Sale" : quickViewProduct.badge}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-4 h-4 ${
                                                        i < Math.floor(quickViewProduct.rating)
                                                            ? "fill-yellow-400 text-yellow-400"
                                                            : "fill-gray-200 text-gray-200"
                                                    }`}
                                                />
                                            ))}
                                            <span className="text-sm text-gray-500 ms-1">
                                                ({quickViewProduct.reviews} reviews)
                                            </span>
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2">{quickViewProduct.name}</h2>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-2xl font-bold">${quickViewProduct.price}</span>
                                        {quickViewProduct.originalPrice && (
                                            <span className="text-lg text-gray-400 line-through">
                                                ${quickViewProduct.originalPrice}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-600 mb-6">{quickViewProduct.description}</p>
                                    
                                    {quickViewProduct.colors.length > 0 && (
                                        <div className="mb-6">
                                            <div className="text-sm font-medium mb-2">Color</div>
                                            <div className="flex gap-2">
                                                {quickViewProduct.colors.map((color) => (
                                                    <button
                                                        key={color}
                                                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-900 transition-colors"
                                                    >
                                                        {color}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-4">
                                        <Button 
                                            onClick={addToCart}
                                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                                        >
                                            <ShoppingCart className="w-4 h-4 me-2" />
                                            Add to Cart
                                        </Button>
                                        <Button variant="outline" size="icon">
                                            <Heart className="w-5 h-5" />
                                        </Button>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Check className="w-4 h-4 text-emerald-500" />
                                            In stock and ready to ship
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Truck className="w-4 h-4" />
                                            Free shipping on orders over $50
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer spacing */}
            <div className="h-20 bg-gray-50" />
        </div>
    );
}
