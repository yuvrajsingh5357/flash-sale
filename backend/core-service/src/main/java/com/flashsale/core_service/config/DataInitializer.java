package com.flashsale.core_service.config;

import com.flashsale.core_service.entity.*;
import com.flashsale.core_service.repository.ProductRepository;
import com.flashsale.core_service.repository.SaleRepository;
import com.flashsale.core_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final SaleRepository saleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RedisTemplate<String, String> redisTemplate;

    @Override
    public void run(String... args) {
        // 1. Seed Admin
        if (!userRepository.existsByEmail("admin@flashsale.com")) {
            User admin = User.builder()
                    .email("admin@flashsale.com")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .role(Role.ROLE_ADMIN)
                    .fullName("Store Merchant Admin")
                    .build();
            userRepository.save(admin);
            log.info("Default Admin user created: admin@flashsale.com / admin123");
        }

        // 2. Seed Default Shopper
        if (!userRepository.existsByEmail("shopper@flashsale.com")) {
            User shopper = User.builder()
                    .email("shopper@flashsale.com")
                    .passwordHash(passwordEncoder.encode("shopper123"))
                    .role(Role.ROLE_SHOPPER)
                    .fullName("Alex Shopper")
                    .build();
            userRepository.save(shopper);
            log.info("Default Shopper user created: shopper@flashsale.com / shopper123");
        }

        // 3. Seed Product
        Product product;
        if (productRepository.count() == 0) {
            product = Product.builder()
                    .name("Sony PlayStation 5 Pro")
                    .description("Next-generation gaming console with 2TB high-speed SSD, 4K ray-tracing, and DualSense wireless controller.")
                    .imageUrl("https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80")
                    .price(new BigDecimal("54999.00"))
                    .build();
            product = productRepository.save(product);
            log.info("Default Product seeded: {}", product.getName());
        } else {
            product = productRepository.findAll().get(0);
        }

        // 4. Seed Live Flash Sale if none exists
        if (saleRepository.count() == 0) {
            Sale sale = Sale.builder()
                    .product(product)
                    .title("Midnight Drop: PS5 Pro Flash Sale")
                    .startTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                    .endTime(Instant.now().plus(2, ChronoUnit.HOURS))
                    .salePrice(new BigDecimal("39999.00"))
                    .stockAllocation(50)
                    .perUserLimit(1)
                    .status(SaleStatus.LIVE)
                    .preloaded(true)
                    .build();
            sale = saleRepository.save(sale);

            // Preload stock into Redis
            String stockKey = "flashsale:stock:" + sale.getId();
            redisTemplate.opsForValue().set(stockKey, "50");
            redisTemplate.opsForValue().set("flashsale:sale:" + sale.getId() + ":status", SaleStatus.LIVE.name());
            redisTemplate.opsForValue().set("flashsale:sale:" + sale.getId() + ":limit", "1");
            redisTemplate.opsForValue().set("flashsale:sale:" + sale.getId() + ":price", "39999.00");
            redisTemplate.opsForValue().set("flashsale:sale:" + sale.getId() + ":productId", String.valueOf(product.getId()));

            log.info("Default Live Flash Sale seeded with id={}, stock=50 in Redis", sale.getId());
        }
    }
}
